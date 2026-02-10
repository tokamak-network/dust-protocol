// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {StealthWalletFactory} from "../src/StealthWalletFactory.sol";
import {StealthAccountFactory} from "../src/StealthAccountFactory.sol";
import "@account-abstraction/interfaces/IEntryPoint.sol";

/// @notice Redeploys both factories with hardened contracts (reentrancy guard, EIP-2 sig validation).
///         Reuses existing EntryPoint and DustPaymaster.
contract RedeployFactories is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        // Existing EntryPoint on Thanos Sepolia
        address entryPoint = 0x5c058Eb93CDee95d72398E5441d989ef6453D038;

        vm.startBroadcast(deployerKey);

        StealthWalletFactory walletFactory = new StealthWalletFactory();
        console.log("StealthWalletFactory:", address(walletFactory));

        StealthAccountFactory accountFactory = new StealthAccountFactory(IEntryPoint(entryPoint));
        console.log("StealthAccountFactory:", address(accountFactory));

        vm.stopBroadcast();
    }
}
