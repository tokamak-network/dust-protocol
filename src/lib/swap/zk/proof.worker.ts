/**
 * Web Worker for DustSwap ZK proof generation
 * Runs Groth16 proving in a separate thread to avoid blocking the UI
 */

import { groth16 } from 'snarkjs'

const WASM_PATH = '/circuits/privateSwap.wasm'
const ZKEY_PATH = '/circuits/privateSwap_final.zkey'

export interface WorkerMessage {
  type: 'generate' | 'verify'
  id: string
  data: any
}

export interface WorkerResponse {
  type: 'progress' | 'result' | 'error'
  id: string
  data?: any
  error?: string
  stage?: string
  progress?: number
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = event.data

  const sendProgress = (stage: string, progress: number) => {
    self.postMessage({ type: 'progress', id, stage, progress } as WorkerResponse)
  }

  try {
    if (type === 'generate') {
      sendProgress('Preparing inputs', 0.1)

      const { circuitInputs } = data

      sendProgress('Loading circuit files', 0.2)
      sendProgress('Generating witness', 0.3)

      const { proof, publicSignals } = await groth16.fullProve(
        circuitInputs,
        WASM_PATH,
        ZKEY_PATH
      )

      sendProgress('Proof generated', 1.0)

      self.postMessage({
        type: 'result',
        id,
        data: { proof, publicSignals },
      } as WorkerResponse)
    } else if (type === 'verify') {
      const { proof, publicSignals, vKey } = data

      sendProgress('Verifying proof', 0.5)

      const isValid = await groth16.verify(vKey, publicSignals, proof)

      self.postMessage({
        type: 'result',
        id,
        data: { isValid },
      } as WorkerResponse)
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as WorkerResponse)
  }
}
