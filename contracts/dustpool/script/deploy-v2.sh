#!/usr/bin/env bash
# Usage: ./deploy-v2.sh <network>
# Networks: thanos-sepolia, ethereum-sepolia
set -euo pipefail

NETWORK="${1:-}"

case "$NETWORK" in
  thanos-sepolia)
    RPC_URL="${THANOS_SEPOLIA_RPC_URL:?Set THANOS_SEPOLIA_RPC_URL}"
    echo "Deploying DustPoolV2 to Thanos Sepolia (111551119090)..."
    ;;
  ethereum-sepolia)
    RPC_URL="${SEPOLIA_RPC_URL:?Set SEPOLIA_RPC_URL}"
    echo "Deploying DustPoolV2 to Ethereum Sepolia (11155111)..."
    ;;
  *)
    echo "Usage: $0 <thanos-sepolia|ethereum-sepolia>"
    exit 1
    ;;
esac

: "${PRIVATE_KEY:?Set PRIVATE_KEY}"

cd "$(dirname "$0")/.."

forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --legacy \
  -vvv
