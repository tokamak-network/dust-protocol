// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IFFLONKVerifier} from "./IFFLONKVerifier.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @dev SafeERC20-style transfer using low-level call (handles non-standard tokens like USDT)
library SafeTransfer {
    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert("ERC20 transfer failed");
        }
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert("ERC20 transferFrom failed");
        }
    }
}

/// @title DustPoolV2 — ZK-UTXO privacy pool with FFLONK proofs
/// @notice 2-in-2-out UTXO model with off-chain Merkle tree. Supports native + ERC20 tokens.
///         Relayers maintain the Merkle tree and post roots on-chain.
contract DustPoolV2 {
    using SafeTransfer for address;
    // BN254 scalar field size
    uint256 public constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ROOT_HISTORY_SIZE = 100;
    /// @dev Max deposit per tx: 2^64 - 1 (matches circuit range proof width)
    uint256 public constant MAX_DEPOSIT_AMOUNT = (1 << 64) - 1;

    IFFLONKVerifier public immutable VERIFIER;
    address public owner;
    address public pendingOwner;
    bool public paused;

    // Root history — circular buffer
    mapping(uint256 => bytes32) public roots;
    uint256 public currentRootIndex;

    // Nullifier tracking — prevents double-spend
    mapping(bytes32 => bool) public nullifiers;

    // Deposit queue — relayer batches these into the off-chain Merkle tree
    mapping(uint256 => bytes32) public depositQueue;
    uint256 public depositQueueTail;

    // Duplicate commitment protection — each commitment can only be deposited once
    mapping(bytes32 => bool) public commitmentUsed;

    // Pool solvency tracking — total deposits per asset, prevents draining beyond deposits
    mapping(address => uint256) public totalDeposited;

    // Relayer whitelist
    mapping(address => bool) public relayers;

    // Reentrancy guard (no OZ available)
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    event DepositQueued(
        bytes32 indexed commitment,
        uint256 queueIndex,
        uint256 amount,
        address asset,
        uint256 timestamp
    );
    event Withdrawal(
        bytes32 indexed nullifier,
        address indexed recipient,
        uint256 amount,
        address asset
    );
    event RootUpdated(bytes32 newRoot, uint256 index, address relayer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event Paused(address account);
    event Unpaused(address account);

    error ZeroCommitment();
    error ZeroValue();
    error UnknownRoot();
    error NullifierAlreadySpent();
    error InvalidProof();
    error InvalidProofLength();
    error InvalidFieldElement();
    error TransferFailed();
    error ERC20TransferFailed();
    error ZeroRecipient();
    error DuplicateCommitment();
    error DepositTooLarge();
    error InsufficientPoolBalance();
    error NotRelayer();
    error NotOwner();
    error NotPendingOwner();
    error ReentrantCall();
    error ContractPaused();

    modifier onlyRelayer() {
        if (!relayers[msg.sender]) revert NotRelayer();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    constructor(address _verifier) {
        VERIFIER = IFFLONKVerifier(_verifier);
        owner = msg.sender;
    }

    /// @notice Deposit native tokens into the pool
    /// @param commitment Poseidon commitment for the UTXO
    function deposit(bytes32 commitment) external payable whenNotPaused {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (msg.value == 0) revert ZeroValue();
        if (msg.value > MAX_DEPOSIT_AMOUNT) revert DepositTooLarge();
        if (commitmentUsed[commitment]) revert DuplicateCommitment();

        commitmentUsed[commitment] = true;
        totalDeposited[address(0)] += msg.value;

        uint256 index = depositQueueTail;
        depositQueue[index] = commitment;
        depositQueueTail = index + 1;

        emit DepositQueued(commitment, index, msg.value, address(0), block.timestamp);
    }

    /// @notice Deposit ERC20 tokens into the pool
    /// @param commitment Poseidon commitment for the UTXO
    /// @param token ERC20 token address
    /// @param amount Token amount to deposit
    function depositERC20(bytes32 commitment, address token, uint256 amount) external nonReentrant whenNotPaused {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (amount == 0) revert ZeroValue();
        if (amount > MAX_DEPOSIT_AMOUNT) revert DepositTooLarge();
        if (commitmentUsed[commitment]) revert DuplicateCommitment();

        commitmentUsed[commitment] = true;

        token.safeTransferFrom(msg.sender, address(this), amount);

        totalDeposited[token] += amount;

        uint256 index = depositQueueTail;
        depositQueue[index] = commitment;
        depositQueueTail = index + 1;

        emit DepositQueued(commitment, index, amount, token, block.timestamp);
    }

    /// @notice Withdraw funds by proving UTXO ownership with an FFLONK proof
    /// @param proof FFLONK proof (24 * 32 = 768 bytes)
    /// @param merkleRoot Merkle root the proof was generated against
    /// @param nullifier0 First input UTXO nullifier
    /// @param nullifier1 Second input UTXO nullifier (bytes32(0) for single-input)
    /// @param outCommitment0 First output UTXO commitment
    /// @param outCommitment1 Second output UTXO commitment
    /// @param publicAmount Net public amount (field element; > FIELD_SIZE/2 encodes withdrawal)
    /// @param publicAsset Asset address (address(0) for native ETH)
    /// @param recipient Address to receive withdrawn funds
    /// @param publicAsset Poseidon(chainId, tokenAddress) — must match circuit public signal
    /// @param tokenAddress Actual token address for transfer (address(0) = native ETH)
    function withdraw(
        bytes calldata proof,
        bytes32 merkleRoot,
        bytes32 nullifier0,
        bytes32 nullifier1,
        bytes32 outCommitment0,
        bytes32 outCommitment1,
        uint256 publicAmount,
        uint256 publicAsset,
        address recipient,
        address tokenAddress
    ) external onlyRelayer nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroRecipient();
        if (!isKnownRoot(merkleRoot)) revert UnknownRoot();

        // All public signals must be valid BN254 field elements to prevent
        // double-spend via field overflow (V and V+FIELD_SIZE are equivalent in proofs)
        if (uint256(merkleRoot) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier0) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier1) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(outCommitment0) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(outCommitment1) >= FIELD_SIZE) revert InvalidFieldElement();
        if (publicAmount >= FIELD_SIZE) revert InvalidFieldElement();

        if (nullifiers[nullifier0]) revert NullifierAlreadySpent();
        if (nullifier1 != bytes32(0) && nullifiers[nullifier1]) {
            revert NullifierAlreadySpent();
        }
        if (proof.length != 768) revert InvalidProofLength();

        // Public signals match circuit order:
        // [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient, chainId]
        uint256[9] memory pubSignals;
        pubSignals[0] = uint256(merkleRoot);
        pubSignals[1] = uint256(nullifier0);
        pubSignals[2] = uint256(nullifier1);
        pubSignals[3] = uint256(outCommitment0);
        pubSignals[4] = uint256(outCommitment1);
        pubSignals[5] = publicAmount;
        pubSignals[6] = publicAsset;
        pubSignals[7] = uint256(uint160(recipient));
        pubSignals[8] = block.chainid;

        bytes32[24] memory proofData;
        for (uint256 i = 0; i < 24; i++) {
            proofData[i] = bytes32(proof[i * 32:(i + 1) * 32]);
        }

        if (!VERIFIER.verifyProof(proofData, pubSignals)) revert InvalidProof();

        // Effects — mark nullifiers spent (skip zero slot used by dummy inputs)
        if (nullifier0 != bytes32(0)) {
            nullifiers[nullifier0] = true;
        }
        if (nullifier1 != bytes32(0)) {
            nullifiers[nullifier1] = true;
        }

        // Queue output commitments + emit events so chain-watcher can discover them
        if (outCommitment0 != bytes32(0)) {
            uint256 idx = depositQueueTail;
            depositQueue[idx] = outCommitment0;
            depositQueueTail = idx + 1;
            emit DepositQueued(outCommitment0, idx, 0, tokenAddress, block.timestamp);
        }
        if (outCommitment1 != bytes32(0)) {
            uint256 idx = depositQueueTail;
            depositQueue[idx] = outCommitment1;
            depositQueueTail = idx + 1;
            emit DepositQueued(outCommitment1, idx, 0, tokenAddress, block.timestamp);
        }

        // Interactions — transfer if publicAmount encodes a withdrawal
        // Values > FIELD_SIZE/2 represent negative field elements (net outflow)
        if (publicAmount != 0 && publicAmount > FIELD_SIZE / 2) {
            uint256 withdrawAmount = FIELD_SIZE - publicAmount;

            // Solvency check: pool cannot pay out more than was deposited per asset
            if (totalDeposited[tokenAddress] < withdrawAmount) revert InsufficientPoolBalance();
            totalDeposited[tokenAddress] -= withdrawAmount;

            if (tokenAddress == address(0)) {
                (bool ok,) = recipient.call{value: withdrawAmount}("");
                if (!ok) revert TransferFailed();
            } else {
                tokenAddress.safeTransfer(recipient, withdrawAmount);
            }

            emit Withdrawal(nullifier0, recipient, withdrawAmount, tokenAddress);
        }
    }

    /// @notice Post a new Merkle root after processing the deposit queue
    /// @param newRoot New Merkle root
    function updateRoot(bytes32 newRoot) external onlyRelayer {
        uint256 newIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[newIndex] = newRoot;
        currentRootIndex = newIndex;

        emit RootUpdated(newRoot, newIndex, msg.sender);
    }

    /// @notice Check if a root exists in the history buffer
    /// @param root Root to check
    /// @return True if root is in the circular buffer
    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        uint256 i = currentRootIndex;
        do {
            if (roots[i] == root) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        } while (i != currentRootIndex);
        return false;
    }

    /// @notice Set or unset a relayer address
    /// @param relayer Address to update
    /// @param allowed Whether to allow or disallow
    function setRelayer(address relayer, bool allowed) external onlyOwner {
        relayers[relayer] = allowed;
    }

    /// @notice Start ownership transfer (2-step)
    /// @param newOwner New owner address (must call acceptOwnership())
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroRecipient();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Accept ownership transfer (must be called by pendingOwner)
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /// @notice Pause all deposits and withdrawals
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    receive() external payable {}
}
