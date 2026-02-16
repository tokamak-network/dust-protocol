#!/bin/bash
set -euo pipefail

echo "=== Deploying Dust Protocol Subgraph to Ethereum Sepolia ==="
echo ""

if [ -z "${GRAPH_DEPLOY_KEY:-}" ]; then
  echo "ERROR: GRAPH_DEPLOY_KEY env var is required"
  echo "Get it from: https://thegraph.com/studio/subgraph/dust-protocol-sepolia/ → Step 4"
  exit 1
fi

VERSION_LABEL="${1:-v0.0.1}"

cd "$(dirname "$0")"

# Build for sepolia network
echo "Building subgraph for sepolia..."
graph codegen
graph build --network sepolia

# Deploy to Subgraph Studio (auth via --deploy-key)
echo ""
echo "Deploying to dust-protocol-sepolia (${VERSION_LABEL})..."
graph deploy dust-protocol-sepolia \
  --network sepolia \
  --node https://api.studio.thegraph.com/deploy/ \
  --deploy-key "$GRAPH_DEPLOY_KEY" \
  --version-label "$VERSION_LABEL"

echo ""
echo "=== Ethereum Sepolia deployment complete ==="
echo "Check status at: https://thegraph.com/studio/subgraph/dust-protocol-sepolia/"
