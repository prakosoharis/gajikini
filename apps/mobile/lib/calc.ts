// Disalin dari packages/@ewa/shared (mobile berdiri sendiri di luar workspace pnpm).
// Jaga tetap sinkron dengan packages/shared/src/index.ts.

export const TRANSFER_FEE = 6_500;
export const MIN_PLATFORM_FEE = 5_000;
export const MIN_WITHDRAWAL = 100_000;

export function platformFeeFor(amount: number, feeRateBps: number): number {
  return Math.max(MIN_PLATFORM_FEE, Math.round((amount * feeRateBps) / 10_000));
}

export function feeBreakdown(amount: number, feeRateBps: number) {
  const platformFee = platformFeeFor(amount, feeRateBps);
  const totalFee = platformFee + TRANSFER_FEE;
  return { platformFee, transferFee: TRANSFER_FEE, totalFee, received: amount - totalFee };
}

export function formatIDR(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

export const STATUS_LABELS: Record<string, string> = {
  MENUNGGU_HR: 'Menunggu HR',
  MENUNGGU_RISK: 'Menunggu Risk',
  DIPROSES_CAIR: 'Sedang dicairkan',
  DICAIRKAN: 'Dicairkan',
  DILUNASI: 'Lunas',
  DITOLAK_HR: 'Ditolak HR',
  DITOLAK_RISK: 'Ditolak Risk',
  GAGAL_CAIR: 'Gagal cair',
};

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  MENUNGGU_HR: { bg: '#fef3c7', fg: '#92400e' },
  MENUNGGU_RISK: { bg: '#ffedd5', fg: '#9a3412' },
  DIPROSES_CAIR: { bg: '#dbeafe', fg: '#1e40af' },
  DICAIRKAN: { bg: '#d1fae5', fg: '#065f46' },
  DILUNASI: { bg: '#e2e8f0', fg: '#475569' },
  DITOLAK_HR: { bg: '#ffe4e6', fg: '#9f1239' },
  DITOLAK_RISK: { bg: '#ffe4e6', fg: '#9f1239' },
  GAGAL_CAIR: { bg: '#fee2e2', fg: '#991b1b' },
};
