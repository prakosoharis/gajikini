// Mesin perhitungan EWA — pure functions, dipakai bersama oleh API dan web.
// Semua nilai uang adalah integer rupiah.

export const TRANSFER_FEE = 6_500;
export const MIN_PLATFORM_FEE = 5_000;
export const MIN_WITHDRAWAL = 100_000;
export const EMPLOYEE_CEILING = 0.8; // maks. 80% dari upah terakru

export type Role = 'EMPLOYEE' | 'HR' | 'RISK' | 'OPS';

export type WithdrawalStatus =
  | 'MENUNGGU_HR'
  | 'MENUNGGU_RISK'
  | 'DIPROSES_CAIR'
  | 'DICAIRKAN'
  | 'DILUNASI'
  | 'DITOLAK_HR'
  | 'DITOLAK_RISK'
  | 'GAGAL_CAIR';

/** Status yang masih memakai limit karyawan pada siklus berjalan. */
export const ACTIVE_STATUSES: WithdrawalStatus[] = [
  'MENUNGGU_HR',
  'MENUNGGU_RISK',
  'DIPROSES_CAIR',
  'DICAIRKAN',
];

/** Status yang membuat karyawan tidak boleh mengajukan request baru. */
export const PENDING_STATUSES: WithdrawalStatus[] = [
  'MENUNGGU_HR',
  'MENUNGGU_RISK',
  'DIPROSES_CAIR',
];

/** Status yang memakai limit fasilitas employer (dana sudah/akan keluar, belum dilunasi). */
export const OUTSTANDING_STATUSES: WithdrawalStatus[] = ['DIPROSES_CAIR', 'DICAIRKAN'];

export const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  MENUNGGU_HR: 'Menunggu HR',
  MENUNGGU_RISK: 'Menunggu Risk',
  DIPROSES_CAIR: 'Sedang dicairkan',
  DICAIRKAN: 'Dicairkan',
  DILUNASI: 'Lunas',
  DITOLAK_HR: 'Ditolak HR',
  DITOLAK_RISK: 'Ditolak Risk',
  GAGAL_CAIR: 'Gagal cair',
};

/** Hitung hari kerja (Senin–Sabtu) inklusif kedua ujung. */
export function countWorkdays(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= last) {
    if (d.getDay() !== 0) count++; // 0 = Minggu
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Upah terakru = gaji pokok x (hari kerja berjalan / total hari kerja siklus). */
export function accruedWage(baseSalary: number, workdaysElapsed: number, totalWorkdays: number): number {
  if (totalWorkdays <= 0) return 0;
  const elapsed = Math.min(Math.max(workdaysElapsed, 0), totalWorkdays);
  return Math.floor((baseSalary * elapsed) / totalWorkdays);
}

/** Platform fee = max(min fee, rate bps x nominal). */
export function platformFeeFor(amount: number, feeRateBps: number): number {
  return Math.max(MIN_PLATFORM_FEE, Math.round((amount * feeRateBps) / 10_000));
}

export interface FeeBreakdown {
  platformFee: number;
  transferFee: number;
  totalFee: number;
  received: number;
}

export function feeBreakdown(amount: number, feeRateBps: number): FeeBreakdown {
  const platformFee = platformFeeFor(amount, feeRateBps);
  const totalFee = platformFee + TRANSFER_FEE;
  return { platformFee, transferFee: TRANSFER_FEE, totalFee, received: amount - totalFee };
}

/** Limit tersedia karyawan = min(80% upah terakru, sisa limit employer) - penarikan aktif siklus ini. */
export function availableLimit(
  accrued: number,
  activeWithdrawn: number,
  employerRemaining: number,
): number {
  const ceiling = Math.floor(EMPLOYEE_CEILING * accrued);
  return Math.max(0, Math.min(ceiling, employerRemaining) - activeWithdrawn);
}

export function formatIDR(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}
