"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import type { PaymentLink } from "@/lib/design/types";
import { useAuth } from "@/contexts/AuthContext";

import { storageKey, migrateKey } from '@/lib/storageKey';

function getStorageKey(address: string, chainId: number) {
  return storageKey('links', address, chainId);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function usePaymentLinks() {
  const { address } = useAccount();
  const { activeChainId } = useAuth();
  const [links, setLinks] = useState<PaymentLink[]>([]);

  // Load from localStorage
  useEffect(() => {
    if (!address) { setLinks([]); return; }
    // Migrate both legacy key formats to hashed key
    migrateKey(`dust_links_${address.toLowerCase()}`, getStorageKey(address, activeChainId));
    migrateKey(`dust_links_${activeChainId}_${address.toLowerCase()}`, getStorageKey(address, activeChainId));
    try {
      const stored = localStorage.getItem(getStorageKey(address, activeChainId));
      if (stored) setLinks(JSON.parse(stored));
      else setLinks([]);
    } catch { setLinks([]); }
  }, [address, activeChainId]);

  const persist = useCallback((updated: PaymentLink[]) => {
    if (!address) return;
    setLinks(updated);
    localStorage.setItem(getStorageKey(address, activeChainId), JSON.stringify(updated));
  }, [address, activeChainId]);

  const createLink = useCallback((data: {
    name: string;
    slug: string;
    description: string;
    emoji: string;
    emojiBg: string;
  }): PaymentLink => {
    const link: PaymentLink = {
      id: generateId(),
      name: data.name,
      slug: data.slug.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
      description: data.description,
      emoji: data.emoji,
      emojiBg: data.emojiBg,
      type: "simple",
      createdAt: Date.now(),
      views: 0,
      payments: 0,
    };
    persist([...links, link]);
    return link;
  }, [links, persist]);

  const deleteLink = useCallback((id: string) => {
    persist(links.filter(l => l.id !== id));
  }, [links, persist]);

  const getLink = useCallback((id: string): PaymentLink | undefined => {
    return links.find(l => l.id === id);
  }, [links]);

  return { links, createLink, deleteLink, getLink };
}
