// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFFLONKVerifier — Interface for the FFLONK proof verifier
/// @notice Matches the generated FflonkVerifier contract's verify function
interface IFFLONKVerifier {
    /// @notice Verify an FFLONK proof
    /// @param proof 24 bytes32 values (4 curve points + 16 field evaluations)
    /// @param pubSignals 8 public signal values from the circuit
    /// @return True if the proof is valid
    function verifyProof(
        bytes32[24] calldata proof,
        uint256[8] calldata pubSignals
    ) external view returns (bool);
}
