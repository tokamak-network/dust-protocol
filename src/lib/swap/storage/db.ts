/**
 * IndexedDB initialization for DustSwap
 * Separate database from the main Dust app to avoid schema conflicts
 */

export const DB_NAME = 'dustswap-db'
export const DB_VERSION = 1

export const STORES = {
  SWAP_NOTES: 'swap-notes',
  MERKLE_TREES: 'merkle-trees',
} as const

let dbInstance: IDBDatabase | null = null

/**
 * Open the DustSwap IndexedDB database
 */
export function openSwapDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('[DustSwap] Failed to open database:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create swap-notes store
      if (!db.objectStoreNames.contains(STORES.SWAP_NOTES)) {
        const notesStore = db.createObjectStore(STORES.SWAP_NOTES, {
          keyPath: 'id',
          autoIncrement: true,
        })

        notesStore.createIndex('commitment', 'commitment', { unique: true })
        notesStore.createIndex('nullifierHash', 'nullifierHash', { unique: true })
        notesStore.createIndex('spent', 'spent', { unique: false })
        notesStore.createIndex('tokenAddress', 'tokenAddress', { unique: false })
        notesStore.createIndex('createdAt', 'createdAt', { unique: false })
      }

      // Create merkle-trees store
      if (!db.objectStoreNames.contains(STORES.MERKLE_TREES)) {
        db.createObjectStore(STORES.MERKLE_TREES, { keyPath: 'id' })
      }
    }
  })
}

/**
 * Close the database connection
 */
export function closeSwapDB(): void {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}
