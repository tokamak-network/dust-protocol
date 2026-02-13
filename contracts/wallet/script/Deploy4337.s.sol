// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "@account-abstraction/core/EntryPoint.sol";
import {StealthAccountFactory} from "../src/StealthAccountFactory.sol";
import {DustPaymaster} from "../src/DustPaymaster.sol";

contract Deploy4337 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        // Allow using an existing EntryPoint (e.g. canonical v0.6 on mainnet/Sepolia)
        address entryPointAddr = vm.envOr("ENTRY_POINT", address(0));

        vm.startBroadcast(deployerKey);

        IEntryPoint entryPoint;
        if (entryPointAddr != address(0)) {
            entryPoint = IEntryPoint(entryPointAddr);
            console.log("Using existing EntryPoint:", entryPointAddr);
        } else {
            EntryPoint ep = new EntryPoint();
            entryPoint = IEntryPoint(address(ep));
            console.log("EntryPoint deployed:", address(entryPoint));
        }

        // 2. Deploy StealthAccountFactory
        StealthAccountFactory factory = new StealthAccountFactory(entryPoint);
        console.log("StealthAccountFactory:", address(factory));

        // 3. Deploy DustPaymaster (deployer is owner + verifying signer)
        DustPaymaster paymaster = new DustPaymaster(entryPoint, deployer);
        console.log("DustPaymaster:", address(paymaster));

        // 4. Fund paymaster deposit on EntryPoint (0.5 ETH for testnets)
        entryPoint.depositTo{value: 0.5 ether}(address(paymaster));
        console.log("Paymaster deposit: 0.5 ETH");
        console.log("Paymaster deposit balance:", entryPoint.balanceOf(address(paymaster)));

        // 5. Stake paymaster (required by bundlers, we self-bundle but do it anyway)
        paymaster.addStake{value: 0.1 ether}(86400); // 1 day unstake delay
        console.log("Paymaster staked: 0.1 ETH");

        vm.stopBroadcast();
    }
}
