// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {DustPool} from "../src/DustPool.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";

contract DeployDustPool is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        Groth16Verifier verifier = new Groth16Verifier();
        DustPool pool = new DustPool(address(verifier));

        console.log("Groth16Verifier:", address(verifier));
        console.log("DustPool:", address(pool));

        vm.stopBroadcast();
    }
}
