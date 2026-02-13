// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {StealthSubAccount7702} from "../src/StealthSubAccount7702.sol";

contract Deploy7702 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        StealthSubAccount7702 impl = new StealthSubAccount7702();
        console.log("StealthSubAccount7702:", address(impl));

        vm.stopBroadcast();
    }
}
