import { ethers } from 'ethers';
import { ec as EC } from 'elliptic';
import { NextResponse } from 'next/server';

const RPC_URL = 'https://rpc.thanos-sepolia.tokamak.network';
const CHAIN_ID = 111551119090;
const SPONSOR_KEY = process.env.RELAYER_PRIVATE_KEY;

const ANNOUNCER_ADDRESS = '0x2C2a59E9e71F2D1A8A2D447E73813B9F89CBb125';
const NAME_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_STEALTH_NAME_REGISTRY_ADDRESS || '0x0129DE641192920AB78eBca2eF4591E2Ac48BA59';
// ERC-4337 Stealth Account Factory (hardened)
const STEALTH_ACCOUNT_FACTORY = '0xfE89381ae27a102336074c90123A003e96512954';
const ENTRY_POINT_ADDRESS = '0x5c058Eb93CDee95d72398E5441d989ef6453D038';
const STEALTH_ACCOUNT_CREATION_CODE = '0x60c060405234801561000f575f80fd5b5060405161088838038061088883398101604081905261002e916100ec565b6001600160a01b03821661007b5760405162461bcd60e51b815260206004820152600f60248201526e16995c9bc8195b9d1c9e541bda5b9d608a1b60448201526064015b60405180910390fd5b6001600160a01b0381166100be5760405162461bcd60e51b815260206004820152600a6024820152692d32b9379037bbb732b960b11b6044820152606401610072565b6001600160a01b039182166080521660a052610124565b6001600160a01b03811681146100e9575f80fd5b50565b5f80604083850312156100fd575f80fd5b8251610108816100d5565b6020840151909250610119816100d5565b809150509250929050565b60805160a05161072961015f5f395f8181609a01526101ea01525f818160e5015281816101530152818161029f015261035e01526107295ff3fe60806040526004361061004c575f3560e01c80633a871cdd146100575780638da5cb5b14610089578063b0d691fe146100d4578063b61d27f614610107578063ece5313214610128575f80fd5b3661005357005b5f80fd5b348015610062575f80fd5b50610076610071366004610519565b610147565b6040519081526020015b60405180910390f35b348015610094575f80fd5b506100bc7f000000000000000000000000000000000000000000000000000000000000000081565b6040516001600160a01b039091168152602001610080565b3480156100df575f80fd5b506100bc7f000000000000000000000000000000000000000000000000000000000000000081565b348015610112575f80fd5b50610126610121366004610583565b610294565b005b348015610133575f80fd5b50610126610142366004610603565b610353565b5f336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016146101915760405163bd07c55160e01b815260040160405180910390fd5b6040517f19457468657265756d205369676e6564204d6573736167653a0a3332000000006020820152603c81018490525f90605c0160408051601f19818403018152919052805160209091012090506001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000166102218261021c61014089018961061c565b610404565b6001600160a01b03161461023957600191505061028d565b8215610288576040515f90339085908381818185875af1925050503d805f811461027e576040519150601f19603f3d011682016040523d82523d5f602084013e610283565b606091505b505050505b5f9150505b9392505050565b336001600160a01b037f000000000000000000000000000000000000000000000000000000000000000016146102dd5760405163bd07c55160e01b815260040160405180910390fd5b5f80856001600160a01b03168585856040516102fa929190610666565b5f6040518083038185875af1925050503d805f8114610334576040519150601f19603f3d011682016040523d82523d5f602084013e610339565b606091505b50915091508161034b57805160208201fd5b505050505050565b336001600160a01b037f0000000000000000000000000000000000000000000000000000000000000000161461039c5760405163bd07c55160e01b815260040160405180910390fd5b478015610400575f826001600160a01b0316826040515f6040518083038185875af1925050503d805f81146103ec576040519150601f19603f3d011682016040523d82523d5f602084013e6103f1565b606091505b50509050806103fe575f80fd5b505b5050565b5f6041821461041457505f61028d565b5f6104226020828587610675565b61042b9161069c565b90505f61043c604060208688610675565b6104459161069c565b90505f8585604081811061045b5761045b6106ba565b919091013560f81c9150507f7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0821115610499575f935050505061028d565b601b8160ff1610156104b3576104b0601b826106ce565b90505b604080515f81526020810180835289905260ff831691810191909152606081018490526080810183905260019060a0016020604051602081039080840390855afa158015610503573d5f803e3d5ffd5b5050604051601f19015198975050505050505050565b5f805f6060848603121561052b575f80fd5b833567ffffffffffffffff811115610541575f80fd5b84016101608187031215610553575f80fd5b95602085013595506040909401359392505050565b80356001600160a01b038116811461057e575f80fd5b919050565b5f805f8060608587031215610596575f80fd5b61059f85610568565b935060208501359250604085013567ffffffffffffffff808211156105c2575f80fd5b818701915087601f8301126105d5575f80fd5b8135818111156105e3575f80fd5b8860208285010111156105f4575f80fd5b95989497505060200194505050565b5f60208284031215610613575f80fd5b61028d82610568565b5f808335601e19843603018112610631575f80fd5b83018035915067ffffffffffffffff82111561064b575f80fd5b60200191503681900382131561065f575f80fd5b9250929050565b818382375f9101908152919050565b5f8085851115610683575f80fd5b8386111561068f575f80fd5b5050820193919092039150565b803560208310156106b4575f19602084900360031b1b165b92915050565b634e487b7160e01b5f52603260045260245ffd5b60ff81811683821601908111156106b457634e487b7160e01b5f52601160045260245ffdfea26469706673582212207f6fd7f10fc3f910abbb729b3e4dad9966c43cf850866292ff9388402960f44b64736f6c63430008140033';

const NAME_REGISTRY_ABI = [
  'function resolveName(string calldata name) external view returns (bytes)',
];

const ANNOUNCER_ABI = [
  'function announce(uint256 schemeId, address stealthAddress, bytes calldata ephemeralPubKey, bytes calldata metadata) external',
];

const secp256k1 = new EC('secp256k1');

// Rate limiting with automatic cleanup
const resolveCooldowns = new Map<string, number>();
const COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_ENTRIES = 1000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  // Periodic cleanup: if map gets large, prune expired entries
  if (resolveCooldowns.size > MAX_COOLDOWN_ENTRIES) {
    for (const [k, t] of resolveCooldowns) {
      if (now - t > COOLDOWN_MS) resolveCooldowns.delete(k);
    }
  }
  const last = resolveCooldowns.get(key);
  if (last && now - last < COOLDOWN_MS) return false;
  resolveCooldowns.set(key, now);
  return true;
}

// Custom JSON-RPC provider that bypasses Next.js fetch patching
class ServerJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  async send(method: string, params: unknown[]): Promise<unknown> {
    const id = this._nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', method, params, id });

    const https = await import('https');
    const url = new URL(RPC_URL);

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk; });
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              if (json.error) reject(new Error(json.error.message || 'RPC Error'));
              else resolve(json.result);
            } catch (e) {
              reject(new Error(`Invalid JSON response: ${data.slice(0, 100)}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

function getProvider() {
  return new ServerJsonRpcProvider(RPC_URL, { name: 'thanos-sepolia', chainId: CHAIN_ID });
}

function computeStealthAccountAddress(ownerEOA: string): string {
  const initCode = ethers.utils.solidityPack(
    ['bytes', 'bytes'],
    [STEALTH_ACCOUNT_CREATION_CODE, ethers.utils.defaultAbiCoder.encode(['address', 'address'], [ENTRY_POINT_ADDRESS, ownerEOA])]
  );
  return ethers.utils.getCreate2Address(STEALTH_ACCOUNT_FACTORY, ethers.constants.HashZero, ethers.utils.keccak256(initCode));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pubKeyToAddress(pubPoint: any): string {
  const uncompressed = pubPoint.encode('hex', false).slice(2);
  const hash = ethers.utils.keccak256('0x' + uncompressed);
  return ethers.utils.getAddress('0x' + hash.slice(-40));
}

function isValidCompressedPublicKey(hex: string): boolean {
  return /^(02|03)[0-9a-fA-F]{64}$/.test(hex);
}

function generateStealthAddress(spendingPublicKey: string, viewingPublicKey: string) {
  const ephemeral = secp256k1.genKeyPair();
  const ephemeralPublicKey = ephemeral.getPublic(true, 'hex');

  const viewPub = secp256k1.keyFromPublic(viewingPublicKey, 'hex');
  const sharedSecret = ephemeral.derive(viewPub.getPublic()).toString('hex').padStart(64, '0');
  const secretHash = ethers.utils.keccak256('0x' + sharedSecret);
  const viewTag = secretHash.slice(2, 4);

  const spendingKey = secp256k1.keyFromPublic(spendingPublicKey, 'hex');
  const hashKey = secp256k1.keyFromPrivate(secretHash.slice(2), 'hex');
  const stealthPubPoint = spendingKey.getPublic().add(hashKey.getPublic());

  const stealthEOAAddress = pubKeyToAddress(stealthPubPoint);
  const stealthAddress = computeStealthAccountAddress(stealthEOAAddress);

  return { stealthAddress, ephemeralPublicKey, viewTag };
}

function parseMetaAddressBytes(metaBytes: string): { spendingPublicKey: string; viewingPublicKey: string } {
  const hex = metaBytes.replace(/^0x/, '');
  if (hex.length !== 132) throw new Error('Invalid meta-address length');

  const spendingPublicKey = hex.slice(0, 66);
  const viewingPublicKey = hex.slice(66, 132);

  if (!isValidCompressedPublicKey(spendingPublicKey) || !isValidCompressedPublicKey(viewingPublicKey)) {
    throw new Error('Invalid public key in meta-address');
  }

  return { spendingPublicKey, viewingPublicKey };
}

function stripTokSuffix(name: string): string {
  const n = name.toLowerCase().trim();
  return n.endsWith('.tok') ? n.slice(0, -4) : n;
}

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(req: Request, { params }: { params: { name: string } }) {
  try {
    if (!SPONSOR_KEY) {
      return NextResponse.json({ error: 'Sponsor not configured' }, { status: 500 });
    }

    const { name } = params;
    const url = new URL(req.url);
    const linkSlug = url.searchParams.get('link') || undefined;

    // Rate limit by name+link
    const cooldownKey = `${name.toLowerCase()}_${linkSlug || ''}`;
    if (!checkRateLimit(cooldownKey)) {
      return NextResponse.json(
        { error: 'Please wait before resolving again' },
        { status: 429, headers: NO_STORE }
      );
    }

    const provider = getProvider();

    // 1. Resolve name → meta-address bytes (strip .tok suffix, matching names.ts)
    const registry = new ethers.Contract(NAME_REGISTRY_ADDRESS, NAME_REGISTRY_ABI, provider);
    const normalized = stripTokSuffix(name);

    const metaBytes: string | null = await (async () => {
      try {
        const result = await registry.resolveName(normalized);
        if (result && result !== '0x' && result.length > 4) return result;
      } catch {}
      return null;
    })();

    if (!metaBytes) {
      return NextResponse.json(
        { error: 'Name not found' },
        { status: 404, headers: NO_STORE }
      );
    }

    // 2. Parse meta-address → spending + viewing public keys (with validation)
    const { spendingPublicKey, viewingPublicKey } = parseMetaAddressBytes(metaBytes);

    // 3. Generate fresh stealth address (random ephemeral key)
    const { stealthAddress, ephemeralPublicKey, viewTag } = generateStealthAddress(spendingPublicKey, viewingPublicKey);

    // 4. Build metadata: viewTag + optional linkSlug hex
    let metadata = '0x' + viewTag;
    if (linkSlug) {
      const slugBytes = new TextEncoder().encode(linkSlug);
      const slugHex = Array.from(slugBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      metadata += slugHex;
    }

    // 5. Announce on-chain (deployer pays gas)
    const sponsor = new ethers.Wallet(SPONSOR_KEY, provider);
    const announcer = new ethers.Contract(ANNOUNCER_ADDRESS, ANNOUNCER_ABI, sponsor);
    const ephPubKeyHex = '0x' + ephemeralPublicKey.replace(/^0x/, '');

    const tx = await announcer.announce(1, stealthAddress, ephPubKeyHex, metadata);
    const receipt = await tx.wait();

    console.log('[Resolve]', normalized, linkSlug || '', '→', stealthAddress, 'tx:', receipt.transactionHash);

    return NextResponse.json(
      {
        stealthAddress,
        network: 'thanos-sepolia',
        chainId: CHAIN_ID,
        announceTxHash: receipt.transactionHash,
      },
      { headers: NO_STORE }
    );
  } catch (e) {
    console.error('[Resolve] Error:', e);
    // Sanitize error messages — don't leak RPC/contract internals
    const raw = e instanceof Error ? e.message : '';
    let message = 'Resolution failed';
    if (raw.includes('Invalid meta-address')) message = 'Invalid meta-address data';
    else if (raw.includes('Invalid public key')) message = 'Corrupted registry data';
    else if (raw.includes('Name not found')) message = 'Name not found';

    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_STORE }
    );
  }
}
