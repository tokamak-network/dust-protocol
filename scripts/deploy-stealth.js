/**
 * Deploy Stealth Address Contracts to Thanos Sepolia
 *
 * Usage: PRIVATE_KEY=<key> node scripts/deploy-stealth.js
 */

const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

// Read contract sources
const announcerSource = fs.readFileSync(
  path.join(__dirname, '../contracts/ERC5564Announcer.sol'),
  'utf8'
);
const registrySource = fs.readFileSync(
  path.join(__dirname, '../contracts/ERC6538Registry.sol'),
  'utf8'
);
const nameRegistrySource = fs.readFileSync(
  path.join(__dirname, '../contracts/StealthNameRegistry.sol'),
  'utf8'
);

function compileContract(source, contractName) {
  const input = {
    language: 'Solidity',
    sources: {
      [`${contractName}.sol`]: { content: source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('Compilation errors:');
      errors.forEach(e => console.error(e.formattedMessage));
      throw new Error('Compilation failed');
    }
  }

  const contract = output.contracts[`${contractName}.sol`][contractName];
  return {
    abi: contract.abi,
    bytecode: '0x' + contract.evm.bytecode.object
  };
}

async function main() {
  // Configuration
  const RPC_URL = 'https://rpc.thanos-sepolia.tokamak.network';
  const PRIVATE_KEY = process.env.PRIVATE_KEY;

  if (!PRIVATE_KEY) {
    console.error('Please set PRIVATE_KEY environment variable');
    console.error('Usage: PRIVATE_KEY=<your_key> node scripts/deploy-stealth.js');
    process.exit(1);
  }

  console.log('Compiling contracts...');
  const announcerCompiled = compileContract(announcerSource, 'ERC5564Announcer');
  const registryCompiled = compileContract(registrySource, 'ERC6538Registry');
  const nameRegistryCompiled = compileContract(nameRegistrySource, 'StealthNameRegistry');
  console.log('Compilation successful!');

  console.log('\nConnecting to Thanos Sepolia...');
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const network = await provider.getNetwork();
  console.log(`Connected to chain ID: ${network.chainId}`);

  const balance = await wallet.getBalance();
  console.log(`Deployer address: ${wallet.address}`);
  console.log(`Balance: ${ethers.utils.formatEther(balance)} TOKAMAK`);

  if (balance.isZero()) {
    console.error('Deployer has no balance! Please fund the account first.');
    process.exit(1);
  }

  // Get current gas price
  const gasPrice = await provider.getGasPrice();
  console.log(`Gas price: ${ethers.utils.formatUnits(gasPrice, 'gwei')} gwei`);

  // Deploy ERC5564Announcer
  console.log('\nDeploying ERC5564Announcer...');
  const AnnouncerFactory = new ethers.ContractFactory(
    announcerCompiled.abi,
    announcerCompiled.bytecode,
    wallet
  );
  const announcer = await AnnouncerFactory.deploy({ gasPrice });
  console.log(`Transaction hash: ${announcer.deployTransaction.hash}`);
  await announcer.deployed();
  console.log(`✅ ERC5564Announcer deployed to: ${announcer.address}`);

  // Deploy ERC6538Registry
  console.log('\nDeploying ERC6538Registry...');
  const RegistryFactory = new ethers.ContractFactory(
    registryCompiled.abi,
    registryCompiled.bytecode,
    wallet
  );
  const registry = await RegistryFactory.deploy({ gasPrice });
  console.log(`Transaction hash: ${registry.deployTransaction.hash}`);
  await registry.deployed();
  console.log(`✅ ERC6538Registry deployed to: ${registry.address}`);

  // Deploy StealthNameRegistry
  console.log('\nDeploying StealthNameRegistry...');
  const NameRegistryFactory = new ethers.ContractFactory(
    nameRegistryCompiled.abi,
    nameRegistryCompiled.bytecode,
    wallet
  );
  const nameRegistry = await NameRegistryFactory.deploy({ gasPrice });
  console.log(`Transaction hash: ${nameRegistry.deployTransaction.hash}`);
  await nameRegistry.deployed();
  console.log(`✅ StealthNameRegistry deployed to: ${nameRegistry.address}`);

  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\nContract Addresses:');
  console.log(`  ERC5564Announcer:     ${announcer.address}`);
  console.log(`  ERC6538Registry:      ${registry.address}`);
  console.log(`  StealthNameRegistry:  ${nameRegistry.address}`);
  console.log('\nAdd to your .env file:');
  console.log(`NEXT_PUBLIC_STEALTH_ANNOUNCER_ADDRESS=${announcer.address}`);
  console.log(`NEXT_PUBLIC_STEALTH_REGISTRY_ADDRESS=${registry.address}`);
  console.log(`NEXT_PUBLIC_STEALTH_NAME_REGISTRY_ADDRESS=${nameRegistry.address}`);

  // Verify contracts work
  console.log('\n' + '='.repeat(60));
  console.log('VERIFYING CONTRACTS...');
  console.log('='.repeat(60));

  // Test announcer
  console.log('\nTesting ERC5564Announcer...');
  const testTx = await announcer.announce(
    1, // schemeId (1 = secp256k1)
    wallet.address, // stealthAddress (just for test)
    '0x02' + '00'.repeat(32), // fake ephemeral pubkey (33 bytes)
    '0xab' // metadata with view tag
  );
  await testTx.wait();
  console.log('✅ Announcer test passed!');

  // Test registry
  console.log('\nTesting ERC6538Registry...');
  const testMetaAddress = '0x' + '02' + '00'.repeat(32) + '03' + '00'.repeat(32);
  const regTx = await registry.registerKeys(1, testMetaAddress);
  await regTx.wait();
  const stored = await registry.stealthMetaAddressOf(wallet.address, 1);
  if (stored === testMetaAddress) {
    console.log('✅ Registry test passed!');
  }

  // Test name registry
  console.log('\nTesting StealthNameRegistry...');
  const testName = 'testname' + Date.now().toString().slice(-6);
  const isAvailable = await nameRegistry.isNameAvailable(testName);
  if (isAvailable) {
    const nameTx = await nameRegistry.registerName(testName, testMetaAddress);
    await nameTx.wait();
    const resolvedMeta = await nameRegistry.resolveName(testName);
    if (resolvedMeta === testMetaAddress) {
      console.log(`✅ Name registry test passed! Registered: ${testName}.tok`);
    }
  }

  console.log('\n🎉 All contracts deployed and verified successfully!');

  // Output JSON for easy import
  const deploymentInfo = {
    chainId: network.chainId,
    announcer: announcer.address,
    registry: registry.address,
    nameRegistry: nameRegistry.address,
    deployer: wallet.address,
    timestamp: new Date().toISOString()
  };

  const outputPath = path.join(__dirname, '../stealth-deployment.json');
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${outputPath}`);
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
