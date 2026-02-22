const ERROR_MAP: [pattern: RegExp, message: string][] = [
  [/no note with sufficient balance/i, 'Not enough shielded balance for this amount'],
  [/proof failed local verification/i, 'Proof generation failed. Please try again.'],
  [/unknown merkle root|unknown root/i, 'Pool state changed during proof. Please retry.'],
  [/rejected by user|user denied|user rejected/i, 'Transaction cancelled'],
  [/wallet not connected/i, 'Please connect your wallet first'],
  [/keys not available/i, 'Please unlock your V2 keys first'],
  [/transaction reverted/i, 'Transaction failed on-chain. Please try again.'],
  [/relayer rejected/i, 'Relayer rejected the transaction. Please try again.'],
  [/amount must be positive/i, 'Amount must be greater than zero'],
  [/amount exceeds maximum/i, 'Amount exceeds the maximum allowed deposit'],
  [/not deployed on chain/i, 'V2 pool is not available on this network'],
  [/public client not available/i, 'Network connection lost. Please refresh and try again.'],
]

export function errorToUserMessage(raw: string): string {
  for (const [pattern, message] of ERROR_MAP) {
    if (pattern.test(raw)) return message
  }
  return 'Something went wrong. Please try again.'
}
