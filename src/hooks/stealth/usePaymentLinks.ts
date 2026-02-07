"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import type { PaymentLink } from "@/lib/design/types";

function getStorageKey(address: string) {
  return `dust_links_${address.toLowerCase()}`;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export function usePaymentLinks() {
  const { address } = useAccount();
  const [links, setLinks] = useState<PaymentLink[]>([]);

  // Load from localStorage
  useEffect(() => {
    if (!address) { setLinks([]); return; }
    try {
      const stored = localStorage.getItem(getStorageKey(address));
      if (stored) setLinks(JSON.parse(stored));
    } catch { setLinks([]); }
  }, [address]);

  const persist = useCallback((updated: PaymentLink[]) => {
    if (!address) return;
    setLinks(updated);
    localStorage.setItem(getStorageKey(address), JSON.stringify(updated));
  }, [address]);

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
