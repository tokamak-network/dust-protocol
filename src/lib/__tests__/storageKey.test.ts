/**
 * End-to-end unit tests for privacy-hardened localStorage key helpers.
 *
 * Covers:
 *  - addrHash: determinism, length, case-insensitivity, domain isolation
 *  - storageKey: format, privacy, chain scoping
 *  - migrateKey: data move, delete legacy, no-overwrite, idempotence
 *  - Privacy invariant: raw address never appears in any generated key
 *
 * Run:  npm test  (vitest)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addrHash, storageKey, migrateKey } from '../storageKey';

// ─── localStorage mock (explicit control over the store) ─────────────────────

const store: Record<string, string> = {};

const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (index: number) => Object.keys(store)[index] ?? null,
};

vi.stubGlobal('localStorage', localStorageMock);
// migrateKey has a `typeof window === 'undefined'` SSR guard — stub window so it passes in Node
vi.stubGlobal('window', { localStorage: localStorageMock });

beforeEach(() => localStorageMock.clear());

// ─── addrHash ────────────────────────────────────────────────────────────────

describe('addrHash', () => {
  const addr = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';

  it('returns exactly 16 hex characters', () => {
    const h = addrHash('pin', addr);
    expect(h).toHaveLength(16);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic for the same (domain, address)', () => {
    expect(addrHash('pin', addr)).toBe(addrHash('pin', addr));
  });

  it('is case-insensitive on the address', () => {
    expect(addrHash('pin', addr.toLowerCase())).toBe(addrHash('pin', addr.toUpperCase()));
  });

  it('produces different hashes for different domains', () => {
    expect(addrHash('pin', addr)).not.toBe(addrHash('payments', addr));
  });

  it('produces different hashes for different addresses', () => {
    const addr2 = '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF';
    expect(addrHash('pin', addr)).not.toBe(addrHash('pin', addr2));
  });

  it('never embeds the raw address in the hash', () => {
    const h = addrHash('payments', addr);
    expect(h).not.toContain(addr.slice(2, 10).toLowerCase());
  });

  it('is case-insensitive: lower/upper/mixed all match', () => {
    expect(addrHash('pin', addr.toLowerCase())).toBe(addrHash('pin', addr.toUpperCase()));
    expect(addrHash('pin', addr.toLowerCase())).toBe(addrHash('pin', addr));
  });
});

// ─── storageKey ──────────────────────────────────────────────────────────────

describe('storageKey', () => {
  const addr = '0xabcdef1234567890abcdef1234567890abcdef12';

  it('without chainId: format is dust_<prefix>_<hash16>', () => {
    const key = storageKey('pin', addr);
    const hash = addrHash('pin', addr);
    expect(key).toBe(`dust_pin_${hash}`);
  });

  it('with chainId: format is dust_<prefix>_<chainId>_<hash16>', () => {
    const key = storageKey('payments', addr, 1);
    const hash = addrHash('payments', addr);
    expect(key).toBe(`dust_payments_1_${hash}`);
  });

  it('does NOT contain the raw wallet address (any case)', () => {
    const key = storageKey('pin', addr);
    expect(key).not.toContain(addr.slice(2).toLowerCase());
    expect(key).not.toContain(addr.toLowerCase());
    expect(key).not.toContain(addr.slice(2).toUpperCase());
  });

  it('different chain IDs produce different keys', () => {
    expect(storageKey('payments', addr, 1)).not.toBe(storageKey('payments', addr, 55004));
  });

  it('different prefixes produce different keys', () => {
    expect(storageKey('pin', addr)).not.toBe(storageKey('payments', addr));
  });

  it('is deterministic (same inputs → same key)', () => {
    expect(storageKey('scanner', addr, 55004)).toBe(storageKey('scanner', addr, 55004));
  });
});

// ─── migrateKey ──────────────────────────────────────────────────────────────

describe('migrateKey', () => {
  const legacy = 'dust_pin_0xabcdef1234567890abcdef1234567890abcdef12';
  const addr = '0xabcdef1234567890abcdef1234567890abcdef12';
  const newKey = storageKey('pin', addr);

  it('copies data from legacy key to new key', () => {
    store[legacy] = 'encrypted-pin-data';
    migrateKey(legacy, newKey);
    expect(store[newKey]).toBe('encrypted-pin-data');
  });

  it('removes the legacy key after migration', () => {
    store[legacy] = 'encrypted-pin-data';
    migrateKey(legacy, newKey);
    expect(localStorageMock.getItem(legacy)).toBeNull();
  });

  it('does NOT overwrite an already-migrated new key', () => {
    store[newKey] = 'correct-current-data';
    store[legacy] = 'stale-legacy-data';
    migrateKey(legacy, newKey);
    // New key unchanged; legacy NOT deleted (migration skipped)
    expect(localStorageMock.getItem(newKey)).toBe('correct-current-data');
    expect(localStorageMock.getItem(legacy)).toBe('stale-legacy-data');
  });

  it('is a no-op when the legacy key does not exist', () => {
    migrateKey('nonexistent_legacy_key_xyz', newKey);
    expect(localStorageMock.getItem(newKey)).toBeNull();
  });

  it('is safe to call multiple times (idempotent)', () => {
    store[legacy] = 'encrypted-pin-data';
    migrateKey(legacy, newKey); // first call — migrates
    migrateKey(legacy, newKey); // second call — no-op (legacy gone)
    expect(localStorageMock.getItem(newKey)).toBe('encrypted-pin-data');
    expect(localStorageMock.getItem(legacy)).toBeNull();
  });

  it('migrates JSON data without corruption', () => {
    const data = JSON.stringify([{ txHash: '0xabc', amount: '1000000000000000000' }]);
    store[legacy] = data;
    migrateKey(legacy, newKey);
    const migrated = localStorageMock.getItem(newKey)!;
    expect(migrated).toBe(data);
    expect(() => JSON.parse(migrated)).not.toThrow();
    expect(JSON.parse(migrated)[0].txHash).toBe('0xabc');
  });
});

// ─── Privacy invariant: no raw address appears in any key ────────────────────

describe('privacy invariant', () => {
  const wallets = [
    '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    '0x0000000000000000000000000000000000000001',
  ];
  const domains = ['pin', 'keyver', 'hdwallet', 'hdwalletsig', 'scanner', 'stealthkeys', 'payments', 'sends', 'links', 'pool', 'onboarded', 'claim2pool'];
  const chains = [1, 55004, 11155111];

  for (const addr of wallets) {
    for (const domain of domains) {
      it(`${domain}/${addr.slice(0, 10)} does not leak raw address`, () => {
        const rawLower = addr.slice(2).toLowerCase();
        const key = storageKey(domain, addr);
        expect(key).not.toContain(rawLower);
        for (const cid of chains) {
          expect(storageKey(domain, addr, cid)).not.toContain(rawLower);
        }
      });
    }
  }
});

// ─── All 12 domains produce unique hashes for the same address ───────────────

describe('domain isolation', () => {
  const addr = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const domains = ['pin', 'keyver', 'hdwallet', 'hdwalletsig', 'scanner', 'stealthkeys', 'payments', 'sends', 'links', 'pool', 'onboarded', 'claim2pool'];

  it('all domains produce distinct addrHash values', () => {
    const hashes = domains.map(d => addrHash(d, addr));
    const unique = new Set(hashes);
    expect(unique.size).toBe(domains.length);
  });
});

// ─── Regression: addrHash must return 64 bits (16 hex chars), not 8 ──────────

describe('addrHash bit-width regression', () => {
  it('returns 16 chars — guards against accidental .slice(0, 8) revert', () => {
    const h = addrHash('pin', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
    expect(h.length).toBe(16);
    // Would fail if someone accidentally reverted to .slice(0, 8)
    expect(h.length).not.toBe(8);
  });
});
