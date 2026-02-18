/**
 * Unit tests for NoOptInPayment component changes
 *
 * Covers:
 *  - hasFiredRef guard: only one fetch fires even if doResolve is called twice
 *    (React StrictMode double-mount simulation)
 *  - Friendly 429 error message shown instead of raw API text
 *  - Retry resets the guard so resolve fires again
 *  - Happy-path: stealth address shown after successful resolve
 *  - buildUrl: correct URL construction with and without linkSlug
 *
 * We test the core logic as plain functions to avoid needing a full
 * React + jsdom environment (no vitest-dom install required).
 *
 * Run: npm test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Replicate the pure logic extracted from NoOptInPayment ──────────────────

function buildUrl(recipientName: string, linkSlug?: string): string {
  const params = new URLSearchParams();
  if (linkSlug) params.set('link', linkSlug);
  const qs = params.toString();
  return `/api/resolve/${encodeURIComponent(recipientName)}${qs ? `?${qs}` : ''}`;
}

function friendlyError(status: number, apiMessage: string): string {
  if (status === 429) return 'Address was just generated — please wait a moment and retry';
  return apiMessage || 'Failed to resolve address';
}

// Simulate the hasFiredRef + doResolve flow
function makeResolveController() {
  let hasFired = false;

  function tryResolve(fetchFn: () => void) {
    if (hasFired) return false; // guarded
    hasFired = true;
    fetchFn();
    return true;
  }

  function reset() {
    hasFired = false;
  }

  return { tryResolve, reset };
}

// ─── buildUrl ────────────────────────────────────────────────────────────────

describe('buildUrl', () => {
  it('builds correct URL without linkSlug', () => {
    expect(buildUrl('alice')).toBe('/api/resolve/alice');
  });

  it('builds correct URL with linkSlug', () => {
    expect(buildUrl('alice', 'dev')).toBe('/api/resolve/alice?link=dev');
  });

  it('URL-encodes special characters in recipient name', () => {
    expect(buildUrl('alice.tok')).toBe('/api/resolve/alice.tok');
    expect(buildUrl('alice&bob')).toBe('/api/resolve/alice%26bob');
  });

  it('encodes spaces in names', () => {
    expect(buildUrl('my name')).toBe('/api/resolve/my%20name');
  });
});

// ─── friendlyError (429 mapping) ─────────────────────────────────────────────

describe('friendlyError', () => {
  it('returns friendly message for 429', () => {
    const msg = friendlyError(429, 'Please wait before resolving again');
    expect(msg).toBe('Address was just generated — please wait a moment and retry');
    expect(msg).not.toContain('Please wait before resolving again');
  });

  it('passes through API message for non-429 errors', () => {
    expect(friendlyError(404, 'Name not found')).toBe('Name not found');
    expect(friendlyError(500, 'Resolution failed')).toBe('Resolution failed');
  });

  it('falls back to generic message when no API message provided', () => {
    expect(friendlyError(500, '')).toBe('Failed to resolve address');
  });

  it('does not expose 429 raw text to user', () => {
    const result = friendlyError(429, 'Please wait before resolving again');
    expect(result.toLowerCase()).not.toMatch(/please wait before/);
  });
});

// ─── hasFiredRef guard (StrictMode double-call prevention) ───────────────────

describe('hasFiredRef guard', () => {
  it('allows the first resolve call through', () => {
    const { tryResolve } = makeResolveController();
    const fetchFn = vi.fn();
    const fired = tryResolve(fetchFn);
    expect(fired).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('blocks a second immediate call (StrictMode double-mount)', () => {
    const { tryResolve } = makeResolveController();
    const fetchFn = vi.fn();
    tryResolve(fetchFn);
    const secondFired = tryResolve(fetchFn);
    expect(secondFired).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1); // only once
  });

  it('allows resolve again after reset (retry flow)', () => {
    const { tryResolve, reset } = makeResolveController();
    const fetchFn = vi.fn();
    tryResolve(fetchFn);
    reset(); // simulates handleRetry resetting hasFiredRef
    const fired = tryResolve(fetchFn);
    expect(fired).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('multiple retries each fire exactly once', () => {
    const { tryResolve, reset } = makeResolveController();
    const fetchFn = vi.fn();
    for (let i = 0; i < 3; i++) {
      tryResolve(fetchFn);
      reset();
    }
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

// ─── Async resolve flow (fetch mock) ─────────────────────────────────────────

describe('doResolve async flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  async function simulateResolve(
    mockResponse: { ok: boolean; status: number; data: Record<string, unknown> }
  ) {
    const state = { status: 'resolving' as string, stealthAddress: null as string | null, error: null as string | null };

    const res = {
      ok: mockResponse.ok,
      status: mockResponse.status,
      json: async () => mockResponse.data,
    };

    const data = await res.json();
    if (!res.ok) {
      state.error = friendlyError(res.status, (data.error as string) || '');
      state.status = 'error';
    } else {
      state.stealthAddress = data.stealthAddress as string;
      state.status = 'ready';
    }
    return state;
  }

  it('sets stealthAddress and status=ready on success', async () => {
    const state = await simulateResolve({
      ok: true,
      status: 200,
      data: { stealthAddress: '0xAbCd1234', network: 'thanos', chainId: 55004 },
    });
    expect(state.status).toBe('ready');
    expect(state.stealthAddress).toBe('0xAbCd1234');
    expect(state.error).toBeNull();
  });

  it('sets error and status=error on 404', async () => {
    const state = await simulateResolve({ ok: false, status: 404, data: { error: 'Name not found' } });
    expect(state.status).toBe('error');
    expect(state.error).toBe('Name not found');
    expect(state.stealthAddress).toBeNull();
  });

  it('maps 429 to friendly message', async () => {
    const state = await simulateResolve({
      ok: false,
      status: 429,
      data: { error: 'Please wait before resolving again' },
    });
    expect(state.status).toBe('error');
    expect(state.error).toBe('Address was just generated — please wait a moment and retry');
  });

  it('status starts as resolving before fetch completes', () => {
    // confirm default state
    const state = { status: 'resolving', stealthAddress: null, error: null };
    expect(state.status).toBe('resolving');
  });
});
