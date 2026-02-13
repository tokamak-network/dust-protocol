// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {StealthSubAccount7702} from "../src/StealthSubAccount7702.sol";

contract StealthSubAccount7702Test is Test {
    event Initialized(address indexed owner);
    event SubAccountCreated(uint256 indexed subId, address indexed delegate, uint256 dailyLimit);
    event SubAccountRevoked(uint256 indexed subId);
    event SubAccountLimitUpdated(uint256 indexed subId, uint256 newLimit);
    event SubAccountExecuted(uint256 indexed subId, address indexed to, uint256 value);
    event Drained(address indexed to, uint256 amount);

    StealthSubAccount7702 impl;

    // "Stealth EOA" — the address that would be delegated via 7702
    uint256 stealthKey = 0xA11CE;
    address stealthAddr;

    // Owner — the user's wallet (set during initialize)
    address ownerWallet = address(0xBEEF);

    // Delegate — a service that can spend from a sub-account
    address delegate = address(0xCAFE);

    address recipient = address(0xDEAD);

    function setUp() public {
        stealthAddr = vm.addr(stealthKey);
        impl = new StealthSubAccount7702();

        // Simulate EIP-7702 delegation: set the implementation's runtime code at the stealth address
        vm.etch(stealthAddr, address(impl).code);
        // Fund the stealth address
        vm.deal(stealthAddr, 10 ether);
    }

    // ═══════════════════════════════════════════
    //  Helper: sign initialize message
    // ═══════════════════════════════════════════

    function _signInitialize(address _stealthAddr, address _owner, uint256 key) internal view returns (bytes memory) {
        bytes32 innerHash = keccak256(abi.encode(_stealthAddr, _owner, block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ═══════════════════════════════════════════
    //  Helper: sign drain message
    // ═══════════════════════════════════════════

    function _signDrain(address _stealthAddr, address to, uint256 nonce, uint256 key) internal view returns (bytes memory) {
        bytes32 innerHash = keccak256(abi.encode(_stealthAddr, to, nonce, block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ═══════════════════════════════════════════
    //  Initialize Tests
    // ═══════════════════════════════════════════

    function test_initialize_validSig() public {
        bytes memory sig = _signInitialize(stealthAddr, ownerWallet, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, sig);

        assertEq(StealthSubAccount7702(payable(stealthAddr)).owner(), ownerWallet);
        assertTrue(StealthSubAccount7702(payable(stealthAddr)).initialized());
    }

    function test_initialize_revert_doubleInit() public {
        bytes memory sig = _signInitialize(stealthAddr, ownerWallet, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, sig);

        vm.expectRevert(StealthSubAccount7702.AlreadyInitialized.selector);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, sig);
    }

    function test_initialize_revert_zeroOwner() public {
        bytes memory sig = _signInitialize(stealthAddr, address(0), stealthKey);
        vm.expectRevert(StealthSubAccount7702.ZeroAddress.selector);
        StealthSubAccount7702(payable(stealthAddr)).initialize(address(0), sig);
    }

    function test_initialize_revert_wrongSigner() public {
        uint256 wrongKey = 0xBAD;
        bytes memory sig = _signInitialize(stealthAddr, ownerWallet, wrongKey);
        vm.expectRevert(StealthSubAccount7702.InvalidSignature.selector);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, sig);
    }

    function test_initialize_emitsEvent() public {
        bytes memory sig = _signInitialize(stealthAddr, ownerWallet, stealthKey);
        vm.expectEmit(true, false, false, false);
        emit Initialized(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, sig);
    }

    // ═══════════════════════════════════════════
    //  Drain Tests
    // ═══════════════════════════════════════════

    function test_drain_beforeInit() public {
        uint256 balBefore = recipient.balance;
        bytes memory sig = _signDrain(stealthAddr, recipient, 0, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig);

        assertEq(recipient.balance, balBefore + 10 ether);
        assertEq(stealthAddr.balance, 0);
    }

    function test_drain_afterInit() public {
        // Initialize first
        bytes memory initSig = _signInitialize(stealthAddr, ownerWallet, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, initSig);

        // Drain
        uint256 balBefore = recipient.balance;
        bytes memory drainSig = _signDrain(stealthAddr, recipient, 0, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, drainSig);

        assertEq(recipient.balance, balBefore + 10 ether);
    }

    function test_drain_incrementsNonce() public {
        bytes memory sig1 = _signDrain(stealthAddr, recipient, 0, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig1);

        assertEq(StealthSubAccount7702(payable(stealthAddr)).drainNonce(), 1);

        // Re-fund and drain again with nonce=1
        vm.deal(stealthAddr, 5 ether);
        bytes memory sig2 = _signDrain(stealthAddr, recipient, 1, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig2);

        assertEq(StealthSubAccount7702(payable(stealthAddr)).drainNonce(), 2);
    }

    function test_drain_revert_wrongSig() public {
        uint256 wrongKey = 0xBAD;
        bytes memory sig = _signDrain(stealthAddr, recipient, 0, wrongKey);
        vm.expectRevert(StealthSubAccount7702.InvalidSignature.selector);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig);
    }

    function test_drain_revert_replayNonce() public {
        bytes memory sig = _signDrain(stealthAddr, recipient, 0, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig);

        // Same sig (nonce=0) should fail — contract nonce is now 1
        vm.deal(stealthAddr, 5 ether);
        vm.expectRevert(StealthSubAccount7702.InvalidSignature.selector);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig);
    }

    function test_drain_revert_zeroAddress() public {
        bytes memory sig = _signDrain(stealthAddr, address(0), 0, stealthKey);
        vm.expectRevert(StealthSubAccount7702.ZeroAddress.selector);
        StealthSubAccount7702(payable(stealthAddr)).drain(address(0), sig);
    }

    function test_drain_emitsEvent() public {
        bytes memory sig = _signDrain(stealthAddr, recipient, 0, stealthKey);
        vm.expectEmit(true, false, false, true);
        emit Drained(recipient, 10 ether);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig);
    }

    function test_drain_zeroBalance() public {
        vm.deal(stealthAddr, 0);
        bytes memory sig = _signDrain(stealthAddr, recipient, 0, stealthKey);
        // Should succeed with 0 transfer
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, sig);
        assertEq(StealthSubAccount7702(payable(stealthAddr)).drainNonce(), 1);
    }

    // ═══════════════════════════════════════════
    //  Sub-Account Tests
    // ═══════════════════════════════════════════

    function _initializeAccount() internal {
        bytes memory sig = _signInitialize(stealthAddr, ownerWallet, stealthKey);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, sig);
    }

    function test_createSubAccount() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        uint256 subId = StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);
        assertEq(subId, 0);

        (address d, uint256 limit, , , bool active) = StealthSubAccount7702(payable(stealthAddr)).subAccounts(0);
        assertEq(d, delegate);
        assertEq(limit, 1 ether);
        assertTrue(active);
    }

    function test_createSubAccount_revert_notOwner() public {
        _initializeAccount();

        vm.prank(address(0x999));
        vm.expectRevert(StealthSubAccount7702.NotOwner.selector);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);
    }

    function test_createSubAccount_revert_notInitialized() public {
        // When not initialized, owner == address(0), so onlyOwner fires first
        vm.prank(ownerWallet);
        vm.expectRevert(StealthSubAccount7702.NotOwner.selector);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);
    }

    function test_createSubAccount_revert_zeroDelegate() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        vm.expectRevert(StealthSubAccount7702.ZeroAddress.selector);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(address(0), 1 ether);
    }

    function test_createSubAccount_emitsEvent() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        vm.expectEmit(true, true, false, true);
        emit SubAccountCreated(0, delegate, 1 ether);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);
    }

    function test_executeFromSub_withinLimit() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        uint256 balBefore = recipient.balance;
        vm.prank(delegate);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");

        assertEq(recipient.balance, balBefore + 1 ether);
    }

    function test_executeFromSub_exactLimit() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        vm.prank(delegate);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 2 ether, "");
        assertEq(recipient.balance, 2 ether);
    }

    function test_executeFromSub_revert_overLimit() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);

        vm.prank(delegate);
        vm.expectRevert(StealthSubAccount7702.OverDailyLimit.selector);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 2 ether, "");
    }

    function test_executeFromSub_revert_cumulativeOverLimit() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1.5 ether);

        vm.prank(delegate);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");

        vm.prank(delegate);
        vm.expectRevert(StealthSubAccount7702.OverDailyLimit.selector);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");
    }

    function test_executeFromSub_revert_notDelegate() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        vm.prank(address(0x999));
        vm.expectRevert(StealthSubAccount7702.NotDelegate.selector);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");
    }

    function test_executeFromSub_revert_inactive() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).revokeSubAccount(0);

        vm.prank(delegate);
        vm.expectRevert(StealthSubAccount7702.InactiveSub.selector);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");
    }

    function test_executeFromSub_dailyReset() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);

        // Spend full daily limit
        vm.prank(delegate);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");

        // Over limit on same day
        vm.prank(delegate);
        vm.expectRevert(StealthSubAccount7702.OverDailyLimit.selector);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 0.5 ether, "");

        // Warp to next day
        vm.warp(block.timestamp + 1 days);

        // Should work again
        vm.prank(delegate);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");
    }

    function test_executeFromSub_emitsEvent() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        vm.prank(delegate);
        vm.expectEmit(true, true, false, true);
        emit SubAccountExecuted(0, recipient, 1 ether);
        StealthSubAccount7702(payable(stealthAddr)).executeFromSub(0, recipient, 1 ether, "");
    }

    // ═══════════════════════════════════════════
    //  Revoke / Update Tests
    // ═══════════════════════════════════════════

    function test_revokeSubAccount() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).revokeSubAccount(0);

        (, , , , bool active) = StealthSubAccount7702(payable(stealthAddr)).subAccounts(0);
        assertFalse(active);
    }

    function test_revokeSubAccount_revert_notOwner() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 2 ether);

        vm.prank(delegate);
        vm.expectRevert(StealthSubAccount7702.NotOwner.selector);
        StealthSubAccount7702(payable(stealthAddr)).revokeSubAccount(0);
    }

    function test_updateSubAccountLimit() public {
        _initializeAccount();

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);

        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).updateSubAccountLimit(0, 5 ether);

        (, uint256 limit, , , ) = StealthSubAccount7702(payable(stealthAddr)).subAccounts(0);
        assertEq(limit, 5 ether);
    }

    // ═══════════════════════════════════════════
    //  Owner Execute Tests
    // ═══════════════════════════════════════════

    function test_execute_ownerCall() public {
        _initializeAccount();

        uint256 balBefore = recipient.balance;
        vm.prank(ownerWallet);
        StealthSubAccount7702(payable(stealthAddr)).execute(recipient, 1 ether, "");
        assertEq(recipient.balance, balBefore + 1 ether);
    }

    function test_execute_revert_notOwner() public {
        _initializeAccount();

        vm.prank(address(0x999));
        vm.expectRevert(StealthSubAccount7702.NotOwner.selector);
        StealthSubAccount7702(payable(stealthAddr)).execute(recipient, 1 ether, "");
    }

    function test_execute_revert_notInitialized() public {
        // When not initialized, owner == address(0), so onlyOwner fires first
        vm.prank(ownerWallet);
        vm.expectRevert(StealthSubAccount7702.NotOwner.selector);
        StealthSubAccount7702(payable(stealthAddr)).execute(recipient, 1 ether, "");
    }

    // ═══════════════════════════════════════════
    //  Edge Cases
    // ═══════════════════════════════════════════

    function test_receiveETH() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = stealthAddr.call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(stealthAddr.balance, 11 ether);
    }

    function test_drain_invalidSigLength() public {
        vm.expectRevert(StealthSubAccount7702.InvalidSignature.selector);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, hex"0011");
    }

    function test_initialize_invalidSigLength() public {
        vm.expectRevert(StealthSubAccount7702.InvalidSignature.selector);
        StealthSubAccount7702(payable(stealthAddr)).initialize(ownerWallet, hex"0011");
    }

    function test_drain_malleableSig() public {
        // Sign with correct key
        bytes32 innerHash = keccak256(abi.encode(stealthAddr, recipient, uint256(0), block.chainid));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(stealthKey, ethHash);

        // Flip s to the upper half of the curve (malleable)
        uint256 sVal = uint256(s);
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 sMalleable = bytes32(n - sVal);
        uint8 vFlipped = v == 27 ? 28 : 27;

        bytes memory malleableSig = abi.encodePacked(r, sMalleable, vFlipped);

        vm.expectRevert(StealthSubAccount7702.InvalidSignature.selector);
        StealthSubAccount7702(payable(stealthAddr)).drain(recipient, malleableSig);
    }

    function test_multipleSubAccounts() public {
        _initializeAccount();

        vm.startPrank(ownerWallet);
        uint256 id0 = StealthSubAccount7702(payable(stealthAddr)).createSubAccount(delegate, 1 ether);
        uint256 id1 = StealthSubAccount7702(payable(stealthAddr)).createSubAccount(address(0xAABB), 2 ether);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(StealthSubAccount7702(payable(stealthAddr)).subAccountCount(), 2);
    }
}
