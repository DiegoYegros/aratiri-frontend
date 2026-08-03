/** Wallet sats required for a coop-exit before the 10k bond reservation. */
export function sparkWithdrawSpendSats(
  amountSats: number,
  feeSats: number,
  deductFeeFromAmount: boolean
): number {
  return deductFeeFromAmount ? amountSats : amountSats + feeSats;
}
