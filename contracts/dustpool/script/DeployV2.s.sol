// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {DustPoolV2} from "../src/DustPoolV2.sol";
import {FflonkVerifier} from "../src/FFLONKVerifier.sol";

contract DeployV2 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        FflonkVerifier verifier = new FflonkVerifier();
        DustPoolV2 pool = new DustPoolV2(address(verifier));

        // Deployer is owner — whitelist as initial relayer
        pool.setRelayer(deployer, true);

        console.log("FflonkVerifier:", address(verifier));
        console.log("DustPoolV2:", address(pool));
        console.log("Relayer:", deployer);

        vm.stopBroadcast();
    }
}
