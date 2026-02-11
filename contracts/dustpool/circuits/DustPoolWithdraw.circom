pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/mux1.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// Prove: "I know a (nullifier, secret, amount) such that
//   commitment = Poseidon(nullifier, secret, amount) is in the Merkle tree,
//   and nullifierHash = Poseidon(nullifier, nullifier)."
// Public: root, nullifierHash, recipient, amount
// Private: nullifier, secret, depositAmount, pathElements[20], pathIndices[20]

template DustPoolWithdraw(levels) {
    // Public inputs
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input amount;

    // Private inputs
    signal input nullifier;
    signal input secret;
    signal input depositAmount;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Verify nullifierHash = Poseidon(nullifier, nullifier)
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHasher.inputs[1] <== nullifier;
    nullifierHash === nullifierHasher.out;

    // 2. Compute commitment = Poseidon(Poseidon(nullifier, secret), depositAmount)
    component commitmentHasher1 = Poseidon(2);
    commitmentHasher1.inputs[0] <== nullifier;
    commitmentHasher1.inputs[1] <== secret;

    component commitmentHasher2 = Poseidon(2);
    commitmentHasher2.inputs[0] <== commitmentHasher1.out;
    commitmentHasher2.inputs[1] <== depositAmount;

    // 3. Verify amount matches deposit
    amount === depositAmount;

    // 4. Range-check amount to 248 bits
    component amountBits = Num2Bits(248);
    amountBits.in <== amount;

    // 5. Merkle proof: walk from leaf (commitment) up to root
    component hashers[levels];
    component mux[levels];

    signal computedPath[levels + 1];
    computedPath[0] <== commitmentHasher2.out;

    for (var i = 0; i < levels; i++) {
        // pathIndices[i] is 0 or 1
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== computedPath[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== computedPath[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];

        computedPath[i + 1] <== hashers[i].out;
    }

    // 6. Verify computed root matches public root
    root === computedPath[levels];

    // 7. Constrain recipient to prevent front-running (square to create constraint)
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

component main {public [root, nullifierHash, recipient, amount]} = DustPoolWithdraw(20);
