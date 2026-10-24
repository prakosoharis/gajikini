import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ACTIVE_STATUSES, EMPLOYEE_CEILING, OUTSTANDING_STATUSES, accruedWage, countWorkdays, formatIDR } from '@ewa/shared';
import { PrismaService } from './prisma.service';
import { DisbursementService } from './disbursement.service';
import { AuthUser, InternalAuthGuard } from './auth';

type ReqUser = { user: AuthUser };

@Controller('internal')
@UseGuards(InternalAuthGuard)
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disbursement: DisbursementService,
  ) {}

  @Get('overview')
  async overview() {
    const employers = await this.prisma.employer.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });

    const portfolio = [] as Array<Record<string, unknown>>;
    for (const e of employers) {
      const agg = await this.prisma.withdrawal.aggregate({
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
        status: e.status,
        employees: e._count.employees,
        outstanding,
        utilization: e.facilityLimit ? outstanding / e.facilityLimit : 0,
      });
    }

    const [riskQueue, disbursements, invoices, statsAgg, feeAgg] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where: { status: 'MENUNGGU_RISK' },
        include: { employee: true, employer: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.disbursement.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: {
          withdrawal: {
            include: { employee: { select: { name: true, bankName: true, bankAccount: true } } },
          },
        },
      }),
      this.prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { employer: { select: { name: true } } },
      }),
      this.prisma.withdrawal.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: { in: ['DICAIRKAN', 'DILUNASI'] } },
      }),
      this.prisma.withdrawal.aggregate({
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

  /**
   * Antrian risk dengan konteks keputusan ("senjata" analis):
   * kesehatan employer, profil karyawan, bendera risiko, dan rekomendasi rule-based.
   */
  @Get('risk-queue')
  async riskQueue() {
    const queue = await this.prisma.withdrawal.findMany({
      where: { status: 'MENUNGGU_RISK' },
      include: { employee: true, employer: true, cycle: true },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const result = [];
    for (const w of queue) {
      const elapsed = countWorkdays(w.cycle.startDate, now < w.cycle.endDate ? now : w.cycle.endDate);
      const accrued = accruedWage(w.employee.baseSalary, elapsed, w.cycle.totalWorkdays);
      const ceiling = Math.floor(EMPLOYEE_CEILING * accrued);

      const [outstandingAgg, cycleTxCount, failCount, successCount, overdueAgg] = await Promise.all([
        this.prisma.withdrawal.aggregate({
          _sum: { amount: true },
          where: { employerId: w.employerId, status: { in: OUTSTANDING_STATUSES } },
        }),
        this.prisma.withdrawal.count({
          where: { employeeId: w.employeeId, cycleId: w.cycleId, status: { in: ACTIVE_STATUSES } },
        }),
        this.prisma.withdrawal.count({ where: { employeeId: w.employeeId, status: 'GAGAL_CAIR' } }),
        this.prisma.withdrawal.count({
          where: { employeeId: w.employeeId, status: { in: ['DICAIRKAN', 'DILUNASI'] } },
        }),
        this.prisma.invoice.aggregate({
          _sum: { total: true },
          _count: true,
          where: { employerId: w.employerId, status: 'BELUM_DIBAYAR', dueDate: { lt: now } },
        }),
      ]);

      const outstanding = outstandingAgg._sum.amount ?? 0;
      const utilNow = w.employer.facilityLimit ? outstanding / w.employer.facilityLimit : 0;
      // Request ini sudah termasuk dalam outstanding (DIPROSES/MENUNGGU tidak; MENUNGGU_RISK belum) —
      // utilAfter = kondisi jika disetujui dan dicairkan.
      const utilAfter = w.employer.facilityLimit ? (outstanding + w.amount) / w.employer.facilityLimit : 0;
      const overdueCount = overdueAgg._count;
      const overdueTotal = overdueAgg._sum.total ?? 0;
      const pctOfCeiling = ceiling > 0 ? w.amount / ceiling : 1;

      const flags: Array<{ code: string; label: string; level: 'MERAH' | 'KUNING' | 'INFO' }> = [];
      if (overdueCount > 0) flags.push({ code: 'TAGIHAN_TELAT', label: `Employer punya ${overdueCount} tagihan telat (${formatIDR(overdueTotal)})`, level: 'MERAH' });
      if (utilAfter > 0.85) flags.push({ code: 'UTIL_TINGGI', label: `Utilisasi fasilitas jadi ${Math.round(utilAfter * 100)}% jika disetujui`, level: 'MERAH' });
      if (w.employer.status !== 'AKTIF') flags.push({ code: 'EMPLOYER_NONAKTIF', label: `Status employer: ${w.employer.status}`, level: 'MERAH' });
      if (pctOfCeiling >= 0.9) flags.push({ code: 'TARIK_MAKSIMAL', label: `Nominal ${Math.round(pctOfCeiling * 100)}% dari limit karyawan`, level: 'KUNING' });
      if (cycleTxCount >= 4) flags.push({ code: 'SERING_TARIK', label: `Tarikan ke-${cycleTxCount} pada siklus ini`, level: 'KUNING' });
      if (failCount > 0) flags.push({ code: 'PERNAH_GAGAL', label: `${failCount}x gagal cair sebelumnya`, level: 'KUNING' });
      if (successCount === 0) flags.push({ code: 'TRANSAKSI_PERTAMA', label: 'Transaksi pertama karyawan ini', level: 'INFO' });

      const recommendation = flags.some((f) => f.level === 'MERAH')
        ? 'TAHAN'
        : flags.some((f) => f.level === 'KUNING')
          ? 'PERIKSA'
          : 'LAYAK';

      result.push({
        id: w.id,
        amount: w.amount,
        received: w.received,
        createdAt: w.createdAt,
        employee: {
          name: w.employee.name,
          baseSalary: w.employee.baseSalary,
          bankName: w.employee.bankName,
          bankAccount: w.employee.bankAccount,
          accrued,
          ceiling,
          pctOfCeiling,
          cycleTxCount,
          failCount,
          successCount,
        },
        employer: {
          id: w.employerId,
          name: w.employer.name,
          status: w.employer.status,
          facilityLimit: w.employer.facilityLimit,
          outstanding,
          utilNow,
          utilAfter,
          overdueCount,
          overdueTotal,
        },
        flags,
        recommendation,
      });
    }
    return result;
  }

  @Post('withdrawals/:id/decision')
  async decision(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: { approve?: boolean; reason?: string },
  ) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id }, include: { employee: true } });
    if (!w) throw new NotFoundException('Request tidak ditemukan');
    if (w.status !== 'MENUNGGU_RISK') throw new BadRequestException('Request sudah diproses');

    const approve = Boolean(body?.approve);
    if (!approve) {
      const updated = await this.prisma.withdrawal.update({
        where: { id },
        data: { status: 'DITOLAK_RISK', rejectReason: body?.reason || 'Ditolak oleh risk analyst', riskDecidedAt: new Date() },
      });
      await this.prisma.audit(req.user.name, req.user.role, 'TOLAK_RISK', 'Withdrawal', id, `${w.employee.name} · ${formatIDR(w.amount)}`);
      return updated;
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: { status: 'DIPROSES_CAIR', riskDecidedAt: new Date() },
    });
    const d = await this.prisma.disbursement.upsert({
      where: { withdrawalId: id },
      create: { withdrawalId: id },
      update: { status: 'PENDING', lastError: null },
    });
    await this.disbursement.enqueue(d.id);
    await this.prisma.audit(req.user.name, req.user.role, 'APPROVE_RISK', 'Withdrawal', id, `${w.employee.name} · ${formatIDR(w.amount)}`);
    return updated;
  }

  @Post('disbursements/:id/retry')
  async retry(@Req() req: ReqUser, @Param('id') id: string) {
    const d = await this.prisma.disbursement.findUnique({ where: { id } });
    if (!d) throw new NotFoundException('Disbursement tidak ditemukan');
    if (d.status !== 'FAILED') throw new BadRequestException('Hanya disbursement gagal yang bisa di-retry');

    await this.prisma.disbursement.update({ where: { id }, data: { status: 'PENDING', attempts: 0, lastError: null } });
    await this.prisma.withdrawal.update({ where: { id: d.withdrawalId }, data: { status: 'DIPROSES_CAIR' } });
    await this.disbursement.enqueue(id);
    await this.prisma.audit(req.user.name, req.user.role, 'RETRY_DISBURSEMENT', 'Disbursement', id);
    return { ok: true };
  }

  @Post('invoices/:id/pay')
  async payInvoice(@Req() req: ReqUser, @Param('id') id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id }, include: { employer: true } });
    if (!invoice) throw new NotFoundException('Tagihan tidak ditemukan');
    if (invoice.status === 'DIBAYAR') throw new BadRequestException('Tagihan sudah dibayar');

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.withdrawal.updateMany({ where: { invoiceId: id }, data: { status: 'DILUNASI' } });
      return tx.invoice.update({ where: { id }, data: { status: 'DIBAYAR', paidAt: new Date() } });
    });
    await this.prisma.audit(
      req.user.name,
      req.user.role,
      'TERIMA_REPAYMENT',
      'Invoice',
      id,
      `${invoice.employer.name} · ${formatIDR(invoice.total)}`,
    );
    return updated;
  }

  @Get('audit')
  async audit() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
