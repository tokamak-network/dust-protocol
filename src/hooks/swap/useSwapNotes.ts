'use client'

/**
 * Hook for managing DustSwap deposit notes (IndexedDB)
 *
 * Provides CRUD operations, export/import, and reactive state
 * for deposit notes used in privacy swaps.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  getAllSwapNotes,
  getUnspentSwapNotes,
  saveSwapNote,
  markSwapNoteAsSpent,
  deleteSwapNote,
  exportSwapNotes,
  importSwapNotes,
  clearAllSwapNotes,
  getSwapNotesCount,
  type StoredSwapNote,
  type DepositNote,
} from '@/lib/swap/storage/swap-notes'

export function useSwapNotes() {
  const [notes, setNotes] = useState<StoredSwapNote[]>([])
  const [unspentNotes, setUnspentNotes] = useState<StoredSwapNote[]>([])
  const [loading, setLoading] = useState(true)
  const [count, setCount] = useState({ total: 0, unspent: 0 })

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      const [allNotes, unspent, counts] = await Promise.all([
        getAllSwapNotes(),
        getUnspentSwapNotes(),
        getSwapNotesCount(),
      ])

      setNotes(allNotes)
      setUnspentNotes(unspent)
      setCount(counts)
    } catch (error) {
      console.error('[DustSwap] Failed to load notes:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const saveNote = useCallback(
    async (
      note: DepositNote,
      tokenAddress: string,
      tokenSymbol: string,
      depositTxHash?: string
    ): Promise<number> => {
      const id = await saveSwapNote(note, tokenAddress, tokenSymbol, depositTxHash)
      await loadNotes()
      return id
    },
    [loadNotes]
  )

  const spendNote = useCallback(
    async (id: number): Promise<void> => {
      await markSwapNoteAsSpent(id)
      await loadNotes()
    },
    [loadNotes]
  )

  const deleteNote = useCallback(
    async (id: number): Promise<void> => {
      await deleteSwapNote(id)
      await loadNotes()
    },
    [loadNotes]
  )

  const exportNotes = useCallback(async (): Promise<string> => {
    return exportSwapNotes()
  }, [])

  const importNotes = useCallback(
    async (jsonString: string): Promise<number> => {
      const imported = await importSwapNotes(jsonString)
      await loadNotes()
      return imported
    },
    [loadNotes]
  )

  const clearNotes = useCallback(async (): Promise<void> => {
    await clearAllSwapNotes()
    await loadNotes()
  }, [loadNotes])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  return {
    notes,
    unspentNotes,
    loading,
    count,
    saveNote,
    spendNote,
    deleteNote,
    exportNotes,
    importNotes,
    clearNotes,
    refresh: loadNotes,
  }
}
