import { NextRequest, NextResponse } from 'next/server';
import {
  ACTIVE_STATUSES,
  MIN_WITHDRAWAL,
  OUTSTANDING_STATUSES,
  PENDING_STATUSES,
  accruedWage,
  availableLimit,
  countWorkdays,
  feeBreakdown,
  formatIDR,
} from '@ewa/shared';
import { prisma } from '../db';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bungkus handler: error → JSON {message}, selaras dengan format NestJS. */
export function handle(fn: (req: NextRequest, params: Record<string, string>) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Record<string, string> }) => {
    try {
      const result = await fn(req, ctx?.params ?? {});
      return NextResponse.json(result as object);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ message: e.message }, { status: e.status });
      }
      console.error(e);
      return NextResponse.json({ message: 'Terjadi kesalahan internal' }, { status: 500 });
    }
  };
}

export function userIdFrom(req: NextRequest): string {
  const id = req.headers.get('x-user-id');
  if (!id) throw new HttpError(400, 'Header x-user-id wajib diisi');
  return id;
}

async function audit(actorName: string, actorRole: string, action: string, entity: string, entityId: string, detail?: string) {
  await prisma.auditLog.create({ data: { actorName, actorRole, action, entity, entityId, detail } });
}

/**
 * Pengganti worker BullMQ di lingkungan serverless (Vercel):
 * disbursement PENDING yang berumur > 3,5 detik diselesaikan saat endpoint polling dipanggil.
 * ±20% gagal per attempt, maksimal 3 attempt — perilaku sama dengan worker Docker.
 */
export async function resolvePendingDisbursements() {
  const cutoff = new Date(Date.now() - 3500);
  const pending = await prisma.disbursement.findMany({
    where: { status: 'PENDING', updatedAt: { lt: cutoff } },
    include: { withdrawal: { include: { employee: true } } },
  });

  for (const d of pending) {
    const attempts = d.attempts + 1;
    if (Math.random() < 0.8) {
      const ref = 'TRX-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
      await prisma.disbursement.update({
        where: { id: d.id },
        data: { status: 'SUCCESS', attempts, ref, lastError: null },
      });
      await prisma.withdrawal.update({
        where: { id: d.withdrawalId },
        data: { status: 'DICAIRKAN', disbursedAt: new Date() },
      });
      await audit('Sistem', 'SYSTEM', 'DISBURSEMENT_SUKSES', 'Disbursement', d.id, `Dana cair ke ${d.withdrawal.employee.name} (${ref})`);
    } else if (attempts >= 3) {
      await prisma.disbursement.update({
        where: { id: d.id },
        data: { status: 'FAILED', attempts, lastError: 'Mock gateway: transfer ditolak (simulasi)' },
      });
      await prisma.withdrawal.update({ where: { id: d.withdrawalId }, data: { status: 'GAGAL_CAIR' } });
      await audit('Sistem', 'SYSTEM', 'DISBURSEMENT_GAGAL', 'Disbursement', d.id, 'Gagal setelah 3 attempt (simulasi)');
    } else {
      await prisma.disbursement.update({
        where: { id: d.id },
        data: { attempts, lastError: 'Mock gateway: transfer ditolak sementara (simulasi)' },
      });
    }
  }
}

// ---------- META ----------

export async function metaUsers() {
  const users = await prisma.user.findMany({
    include: { employee: { include: { employer: true } }, employer: true },
    orderBy: { name: 'asc' },
  });
  const employees = users
    .filter((u) => u.role === 'EMPLOYEE' && u.employee)
    .slice(0, 8)
    .map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      info: `${u.employee!.employer.name} · gaji ${formatIDR(u.employee!.baseSalary)}`,
    }));
  const hr = users
    .filter((u) => u.role === 'HR')
    .map((u) => ({ id: u.id, name: u.name, role: u.role, info: u.employer?.name ?? '' }));
  const internal = users
    .filter((u) => u.role === 'RISK' || u.role === 'OPS')
    .map((u) => ({ id: u.id, name: u.name, role: u.role, info: u.role === 'RISK' ? 'Risk Analyst' : 'Operations' }));
  return { employees, hr, internal };
}

// ---------- EMPLOYEE ----------

/** Login karyawan via nomor HP (aplikasi mobile). OTP mock: 6 digit apa pun — demo saja. */
export async function employeeLogin(phoneRaw: unknown, otpRaw: unknown) {
  const phone = String(phoneRaw || '').trim();
  const otp = String(otpRaw || '').trim();
  if (!/^08\d{8,12}$/.test(phone)) throw new HttpError(400, 'Nomor HP harus format 08xxxxxxxxxx');
  if (!/^\d{6}$/.test(otp)) throw new HttpError(400, 'Kode OTP harus 6 digit');

  const employee = await prisma.employee.findFirst({
    where: { phone },
    include: { employer: true, user: true },
  });
  if (!employee || !employee.user) throw new HttpError(404, 'Nomor HP tidak terdaftar. Hubungi HR perusahaan Anda.');
  if (employee.status !== 'AKTIF') throw new HttpError(400, 'Status kepegawaian Anda tidak aktif. Hubungi HR Anda.');

  await prisma.auditLog.create({
    data: { actorName: employee.name, actorRole: 'EMPLOYEE', action: 'LOGIN_MOBILE', entity: 'Employee', entityId: employee.id, detail: employee.employer.name },
  });
  return { userId: employee.user.id, name: employee.name, employerName: employee.employer.name };
}

async function employeeContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: { include: { employer: true } } },
  });
  if (!user || !user.employee) throw new HttpError(404, 'User karyawan tidak ditemukan');
  const cycle = await prisma.payrollCycle.findFirst({
    where: { employerId: user.employee.employerId, status: 'AKTIF' },
    orderBy: { startDate: 'desc' },
  });
  if (!cycle) throw new HttpError(404, 'Tidak ada siklus payroll aktif');
  return { user, employee: user.employee, employer: user.employee.employer, cycle };
}

async function limitFor(
  employeeId: string,
  employerId: string,
  cycle: { id: string; startDate: Date; endDate: Date; totalWorkdays: number },
  baseSalary: number,
  facilityLimit: number,
) {
  const now = new Date();
  const elapsed = countWorkdays(cycle.startDate, now < cycle.endDate ? now : cycle.endDate);
  const accrued = accruedWage(baseSalary, elapsed, cycle.totalWorkdays);
  const activeAgg = await prisma.withdrawal.aggregate({
    _sum: { amount: true },
    where: { employeeId, cycleId: cycle.id, status: { in: ACTIVE_STATUSES } },
  });
  const outstandingAgg = await prisma.withdrawal.aggregate({
    _sum: { amount: true },
    where: { employerId, status: { in: OUTSTANDING_STATUSES } },
  });
  const activeWithdrawn = activeAgg._sum.amount ?? 0;
  const outstanding = outstandingAgg._sum.amount ?? 0;
  const employerRemaining = Math.max(0, facilityLimit - outstanding);
  return { elapsed, accrued, activeWithdrawn, employerRemaining, limit: availableLimit(accrued, activeWithdrawn, employerRemaining) };
}

export async function employeeSummary(userId: string) {
  await resolvePendingDisbursements();
  const { employee, employer, cycle } = await employeeContext(userId);
  const calc = await limitFor(employee.id, employer.id, cycle, employee.baseSalary, employer.facilityLimit);
  const withdrawals = await prisma.withdrawal.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { disbursement: { select: { status: true, ref: true, attempts: true } } },
  });
  const hasPending = withdrawals.some((w) => PENDING_STATUSES.includes(w.status as never));
  return {
    employee: {
      name: employee.name,
      baseSalary: employee.baseSalary,
      bankName: employee.bankName,
      bankAccount: employee.bankAccount,
      kycStatus: employee.kycStatus,
    },
    employer: { name: employer.name, feeRateBps: employer.feeRateBps },
    cycle: {
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      payday: cycle.payday,
      totalWorkdays: cycle.totalWorkdays,
      workdaysElapsed: calc.elapsed,
    },
    accrued: calc.accrued,
    activeWithdrawn: calc.activeWithdrawn,
    limit: calc.limit,
    minWithdrawal: MIN_WITHDRAWAL,
    hasPending,
    withdrawals,
  };
}

export async function createWithdrawal(userId: string, amountRaw: unknown) {
  const { user, employee, employer, cycle } = await employeeContext(userId);
  const amount = Math.floor(Number(amountRaw));
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
    throw new HttpError(400, `Nominal penarikan minimal ${formatIDR(MIN_WITHDRAWAL)}`);
  }
  const pending = await prisma.withdrawal.findFirst({
    where: { employeeId: employee.id, status: { in: PENDING_STATUSES } },
  });
  if (pending) throw new HttpError(400, 'Masih ada request yang sedang diproses. Tunggu sampai selesai.');
  const calc = await limitFor(employee.id, employer.id, cycle, employee.baseSalary, employer.facilityLimit);
  if (amount > calc.limit) throw new HttpError(400, `Nominal melebihi limit tersedia (${formatIDR(calc.limit)})`);
  const fees = feeBreakdown(amount, employer.feeRateBps);
  const w = await prisma.withdrawal.create({
    data: {
      employeeId: employee.id,
      employerId: employer.id,
      cycleId: cycle.id,
      amount,
      platformFee: fees.platformFee,
      transferFee: fees.transferFee,
      received: fees.received,
      status: 'MENUNGGU_HR',
    },
  });
  await audit(user.name, 'EMPLOYEE', 'REQUEST_PENARIKAN', 'Withdrawal', w.id, `${formatIDR(amount)} oleh ${employee.name}`);
  return w;
}

// ---------- HR ----------

async function hrContext(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { employer: true } });
  if (!user || user.role !== 'HR' || !user.employer) throw new HttpError(404, 'User HR tidak ditemukan');
  const cycle = await prisma.payrollCycle.findFirst({
    where: { employerId: user.employer.id, status: 'AKTIF' },
    orderBy: { startDate: 'desc' },
  });
  if (!cycle) throw new HttpError(404, 'Tidak ada siklus payroll aktif');
  return { user, employer: user.employer, cycle };
}

export async function hrOverview(userId: string) {
  await resolvePendingDisbursements();
  const { employer, cycle } = await hrContext(userId);
  const now = new Date();
  const elapsed = countWorkdays(cycle.startDate, now < cycle.endDate ? now : cycle.endDate);
  const [totalEmployees, pending, cycleAgg, outstandingAgg] = await Promise.all([
    prisma.employee.count({ where: { employerId: employer.id, status: 'AKTIF' } }),
    prisma.withdrawal.findMany({
      where: { employerId: employer.id, status: 'MENUNGGU_HR' },
      include: { employee: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.withdrawal.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { cycleId: cycle.id, status: { in: ['DICAIRKAN', 'DILUNASI'] } },
    }),
    prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: { employerId: employer.id, status: { in: OUTSTANDING_STATUSES } },
    }),
  ]);
  const outstanding = outstandingAgg._sum.amount ?? 0;
  return {
    employer: { name: employer.name, facilityLimit: employer.facilityLimit, feeRateBps: employer.feeRateBps },
    cycle: {
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      payday: cycle.payday,
      totalWorkdays: cycle.totalWorkdays,
      workdaysElapsed: elapsed,
    },
    stats: {
      totalEmployees,
      cycleWithdrawn: cycleAgg._sum.amount ?? 0,
      cycleTransactions: cycleAgg._count,
      outstanding,
      utilization: employer.facilityLimit ? outstanding / employer.facilityLimit : 0,
    },
    pending,
  };
}

export async function hrEmployees(userId: string) {
  const { employer, cycle } = await hrContext(userId);
  const now = new Date();
  const elapsed = countWorkdays(cycle.startDate, now < cycle.endDate ? now : cycle.endDate);
  const list = await prisma.employee.findMany({
    where: { employerId: employer.id },
    orderBy: { name: 'asc' },
    include: {
      withdrawals: { where: { cycleId: cycle.id, status: { in: ACTIVE_STATUSES } }, select: { amount: true } },
    },
  });
  return list.map((e) => ({
    id: e.id,
    nik: e.nik,
    name: e.name,
    baseSalary: e.baseSalary,
    kycStatus: e.kycStatus,
    status: e.status,
    accrued: accruedWage(e.baseSalary, elapsed, cycle.totalWorkdays),
    withdrawnThisCycle: e.withdrawals.reduce((s, w) => s + w.amount, 0),
  }));
}

export async function hrDecision(userId: string, id: string, approve: boolean, reason?: string) {
  const { user, employer } = await hrContext(userId);
  const w = await prisma.withdrawal.findUnique({ where: { id }, include: { employee: true } });
  if (!w || w.employerId !== employer.id) throw new HttpError(404, 'Request tidak ditemukan');
  if (w.status !== 'MENUNGGU_HR') throw new HttpError(400, 'Request sudah diproses');
  const updated = await prisma.withdrawal.update({
    where: { id },
    data: {
      status: approve ? 'MENUNGGU_RISK' : 'DITOLAK_HR',
      rejectReason: approve ? null : reason || 'Ditolak oleh HR',
      hrDecidedAt: new Date(),
    },
  });
  await audit(user.name, 'HR', approve ? 'APPROVE_HR' : 'TOLAK_HR', 'Withdrawal', id, `${w.employee.name} · ${formatIDR(w.amount)}`);
  return updated;
}

export async function hrReport(userId: string) {
  const { employer, cycle } = await hrContext(userId);
  const rows = await prisma.withdrawal.findMany({
    where: { cycleId: cycle.id, status: { in: ['DICAIRKAN', 'DILUNASI'] } },
    include: { employee: true },
  });
  const byEmployee = new Map<string, { nik: string; name: string; baseSalary: number; totalDeduction: number; count: number }>();
  for (const w of rows) {
    const cur = byEmployee.get(w.employeeId) ?? {
      nik: w.employee.nik,
      name: w.employee.name,
      baseSalary: w.employee.baseSalary,
      totalDeduction: 0,
      count: 0,
    };
    cur.totalDeduction += w.amount;
    cur.count += 1;
    byEmployee.set(w.employeeId, cur);
  }
  const report = Array.from(byEmployee.values())
    .map((r) => ({ ...r, netSalary: r.baseSalary - r.totalDeduction }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const pendingCount = await prisma.withdrawal.count({
    where: { cycleId: cycle.id, status: { in: PENDING_STATUSES } },
  });
  return {
    cycle: { startDate: cycle.startDate, endDate: cycle.endDate, payday: cycle.payday },
    report,
    total: report.reduce((s, r) => s + r.totalDeduction, 0),
    pendingCount,
  };
}

export async function hrClosePayday(userId: string) {
  const { user, employer, cycle } = await hrContext(userId);
  const pendingCount = await prisma.withdrawal.count({
    where: { cycleId: cycle.id, status: { in: PENDING_STATUSES } },
  });
  if (pendingCount > 0) {
    throw new HttpError(400, `Masih ada ${pendingCount} request yang belum selesai diproses. Selesaikan antrian dulu.`);
  }
  const disbursed = await prisma.withdrawal.findMany({
    where: { cycleId: cycle.id, status: 'DICAIRKAN', invoiceId: null },
  });
  const total = disbursed.reduce((s, w) => s + w.amount, 0);
  const result = await prisma.$transaction(async (tx) => {
    let invoice = null;
    if (total > 0) {
      invoice = await tx.invoice.create({
        data: { employerId: employer.id, cycleId: cycle.id, total, dueDate: cycle.payday },
      });
      await tx.withdrawal.updateMany({
        where: { id: { in: disbursed.map((w) => w.id) } },
        data: { invoiceId: invoice.id },
      });
    }
    await tx.payrollCycle.update({ where: { id: cycle.id }, data: { status: 'DITUTUP' } });
    const nextStart = new Date(cycle.endDate.getFullYear(), cycle.endDate.getMonth() + 1, 1);
    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
    const next = await tx.payrollCycle.create({
      data: {
        employerId: employer.id,
        startDate: nextStart,
        endDate: nextEnd,
        payday: nextEnd,
        totalWorkdays: countWorkdays(nextStart, nextEnd),
      },
    });
    return { invoice, next };
  });
  await audit(user.name, 'HR', 'TUTUP_SIKLUS', 'PayrollCycle', cycle.id, total > 0 ? `Tagihan ${formatIDR(total)} diterbitkan` : 'Tanpa tagihan');
  return result;
}

export async function hrInvoices(userId: string) {
  const { employer } = await hrContext(userId);
  return prisma.invoice.findMany({
    where: { employerId: employer.id },
    orderBy: { createdAt: 'desc' },
    include: { cycle: { select: { startDate: true, endDate: true } } },
  });
}

// ---------- INTERNAL ----------

async function internalContext(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.role !== 'RISK' && user.role !== 'OPS')) throw new HttpError(404, 'User internal tidak ditemukan');
  return { user };
}

export async function internalOverview(userId: string) {
  await internalContext(userId);
  await resolvePendingDisbursements();

  const employers = await prisma.employer.findMany({
    include: { _count: { select: { employees: true } } },
    orderBy: { name: 'asc' },
  });
  const portfolio = [] as Array<Record<string, unknown>>;
  for (const e of employers) {
    const agg = await prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: { employerId: e.id, status: { in: OUTSTANDING_STATUSES } },
    });
    const outstanding = agg._sum.amount ?? 0;
    portfolio.push({
      id: e.id,
      name: e.name,
      sector: e.sector,
      feeRateBps: e.feeRateBps,
      facilityLimit: e.facilityLimit,
      employees: e._count.employees,
      outstanding,
      utilization: e.facilityLimit ? outstanding / e.facilityLimit : 0,
    });
  }

  const [riskQueue, disbursements, invoices, statsAgg, feeAgg] = await Promise.all([
    prisma.withdrawal.findMany({
      where: { status: 'MENUNGGU_RISK' },
      include: { employee: true, employer: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.disbursement.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        withdrawal: { include: { employee: { select: { name: true, bankName: true, bankAccount: true } } } },
      },
    }),
    prisma.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { employer: { select: { name: true } } },
    }),
    prisma.withdrawal.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { status: { in: ['DICAIRKAN', 'DILUNASI'] } },
    }),
    prisma.withdrawal.aggregate({
      _sum: { platformFee: true },
      where: { status: { in: ['DICAIRKAN', 'DILUNASI'] } },
    }),
  ]);

  return {
    portfolio,
    riskQueue,
    disbursements,
    invoices,
    stats: {
      tpv: statsAgg._sum.amount ?? 0,
      transactions: statsAgg._count,
      feeRevenue: feeAgg._sum.platformFee ?? 0,
    },
  };
}

export async function internalDecision(userId: string, id: string, approve: boolean, reason?: string) {
  const { user } = await internalContext(userId);
  const w = await prisma.withdrawal.findUnique({ where: { id }, include: { employee: true } });
  if (!w) throw new HttpError(404, 'Request tidak ditemukan');
  if (w.status !== 'MENUNGGU_RISK') throw new HttpError(400, 'Request sudah diproses');
  if (!approve) {
    const updated = await prisma.withdrawal.update({
      where: { id },
      data: { status: 'DITOLAK_RISK', rejectReason: reason || 'Ditolak oleh risk analyst', riskDecidedAt: new Date() },
    });
    await audit(user.name, user.role, 'TOLAK_RISK', 'Withdrawal', id, `${w.employee.name} · ${formatIDR(w.amount)}`);
    return updated;
  }
  const updated = await prisma.withdrawal.update({
    where: { id },
    data: { status: 'DIPROSES_CAIR', riskDecidedAt: new Date() },
  });
  await prisma.disbursement.upsert({
    where: { withdrawalId: id },
    create: { withdrawalId: id },
    update: { status: 'PENDING', lastError: null },
  });
  await audit(user.name, user.role, 'APPROVE_RISK', 'Withdrawal', id, `${w.employee.name} · ${formatIDR(w.amount)}`);
  return updated;
}

export async function internalRetry(userId: string, id: string) {
  const { user } = await internalContext(userId);
  const d = await prisma.disbursement.findUnique({ where: { id } });
  if (!d) throw new HttpError(404, 'Disbursement tidak ditemukan');
  if (d.status !== 'FAILED') throw new HttpError(400, 'Hanya disbursement gagal yang bisa di-retry');
  await prisma.disbursement.update({ where: { id }, data: { status: 'PENDING', attempts: 0, lastError: null } });
  await prisma.withdrawal.update({ where: { id: d.withdrawalId }, data: { status: 'DIPROSES_CAIR' } });
  await audit(user.name, user.role, 'RETRY_DISBURSEMENT', 'Disbursement', id);
  return { ok: true };
}

export async function internalPayInvoice(userId: string, id: string) {
  const { user } = await internalContext(userId);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { employer: true } });
  if (!invoice) throw new HttpError(404, 'Tagihan tidak ditemukan');
  if (invoice.status === 'DIBAYAR') throw new HttpError(400, 'Tagihan sudah dibayar');
  const updated = await prisma.$transaction(async (tx) => {
    await tx.withdrawal.updateMany({ where: { invoiceId: id }, data: { status: 'DILUNASI' } });
    return tx.invoice.update({ where: { id }, data: { status: 'DIBAYAR', paidAt: new Date() } });
  });
  await audit(user.name, user.role, 'TERIMA_REPAYMENT', 'Invoice', id, `${invoice.employer.name} · ${formatIDR(invoice.total)}`);
  return updated;
}

export async function internalAudit(userId: string) {
  await internalContext(userId);
  return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 });
}
