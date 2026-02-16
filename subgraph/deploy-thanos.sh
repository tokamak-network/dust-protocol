#!/bin/bash
set -euo pipefail

echo "=== Deploying Dust Protocol Subgraph to Thanos Sepolia ==="
echo ""
echo "NOTE: Thanos Sepolia is a custom network not supported on Subgraph Studio."
echo "This script requires a self-hosted Graph Node."
echo ""

if [ -z "${GRAPH_NODE_URL:-}" ]; then
  echo "ERROR: GRAPH_NODE_URL env var is required (e.g. http://localhost:8020)"
  exit 1
fi

if [ -z "${IPFS_URL:-}" ]; then
  echo "ERROR: IPFS_URL env var is required (e.g. http://localhost:5001)"
  exit 1
fi

cd "$(dirname "$0")"

# Build for thanos-sepolia network
echo "Building subgraph for thanos-sepolia..."
graph codegen
graph build --network thanos-sepolia

# Deploy to self-hosted Graph Node
echo ""
echo "Deploying to dust-protocol-thanos..."
graph create --node "$GRAPH_NODE_URL" dust-protocol-thanos 2>/dev/null || true
graph deploy --node "$GRAPH_NODE_URL" --ipfs "$IPFS_URL" dust-protocol-thanos --network thanos-sepolia

echo ""
echo "=== Thanos Sepolia deployment complete ==="
