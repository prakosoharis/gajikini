import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ACTIVE_STATUSES,
  OUTSTANDING_STATUSES,
  PENDING_STATUSES,
  accruedWage,
  countWorkdays,
  formatIDR,
} from '@ewa/shared';
import { PrismaService } from './prisma.service';
import { AuthUser, HrAuthGuard } from './auth';

type ReqUser = { user: AuthUser };

interface EmployeeInput {
  nik?: string;
  name?: string;
  phone?: string;
  baseSalary?: number | string;
  bankName?: string;
  bankAccount?: string;
}

function validateEmployeeInput(body: EmployeeInput, partial = false) {
  const out: Record<string, unknown> = {};
  const want = (k: keyof EmployeeInput) => body[k] !== undefined || !partial;

  if (want('nik')) {
    const nik = String(body.nik || '').trim();
    if (!/^\d{16}$/.test(nik)) throw new BadRequestException('NIK harus 16 digit angka');
    out.nik = nik;
  }
  if (want('name')) {
    const name = String(body.name || '').trim();
    if (name.length < 3) throw new BadRequestException('Nama minimal 3 karakter');
    out.name = name;
  }
  if (want('phone')) {
    const phone = String(body.phone || '').trim();
    if (!/^08\d{8,12}$/.test(phone)) throw new BadRequestException('No. HP harus format 08xxxxxxxxxx');
    out.phone = phone;
  }
  if (want('baseSalary')) {
    const v = Math.floor(Number(body.baseSalary));
    if (!Number.isFinite(v) || v < 500_000 || v > 100_000_000) throw new BadRequestException('Gaji pokok tidak wajar');
    out.baseSalary = v;
  }
  if (want('bankName')) {
    const b = String(body.bankName || '').trim();
    if (b.length < 2) throw new BadRequestException('Nama bank wajib diisi');
    out.bankName = b;
  }
  if (want('bankAccount')) {
    const a = String(body.bankAccount || '').trim();
    if (!/^\d{6,20}$/.test(a)) throw new BadRequestException('No. rekening harus 6–20 digit angka');
    out.bankAccount = a;
  }
  return out;
}

@Controller('hr')
@UseGuards(HrAuthGuard)
export class HrController {
  constructor(private readonly prisma: PrismaService) {}

  private async context(user: AuthUser) {
    if (!user.employerId) throw new NotFoundException('User HR tidak terikat employer');
    const employer = await this.prisma.employer.findUnique({ where: { id: user.employerId } });
    if (!employer) throw new NotFoundException('Employer tidak ditemukan');
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { employerId: employer.id, status: 'AKTIF' },
      orderBy: { startDate: 'desc' },
    });
    if (!cycle) throw new NotFoundException('Tidak ada siklus payroll aktif');
    return { employer, cycle };
  }

  @Get('overview')
  async overview(@Req() req: ReqUser) {
    const { employer, cycle } = await this.context(req.user);
    const now = new Date();
    const elapsed = countWorkdays(cycle.startDate, now < cycle.endDate ? now : cycle.endDate);

    const [totalEmployees, pending, cycleAgg, outstandingAgg] = await Promise.all([
      this.prisma.employee.count({ where: { employerId: employer.id, status: 'AKTIF' } }),
      this.prisma.withdrawal.findMany({
        where: { employerId: employer.id, status: 'MENUNGGU_HR' },
        include: { employee: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.withdrawal.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { cycleId: cycle.id, status: { in: ['DICAIRKAN', 'DILUNASI'] } },
      }),
      this.prisma.withdrawal.aggregate({
        _sum: { amount: true },
        where: { employerId: employer.id, status: { in: OUTSTANDING_STATUSES } },
      }),
    ]);

    const outstanding = outstandingAgg._sum.amount ?? 0;
    return {
      employer: { name: employer.name, status: employer.status, facilityLimit: employer.facilityLimit, feeRateBps: employer.feeRateBps },
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

  // ---------- KARYAWAN CRUD ----------

  @Get('employees')
  async employees(@Req() req: ReqUser) {
    const { employer, cycle } = await this.context(req.user);
    const now = new Date();
    const elapsed = countWorkdays(cycle.startDate, now < cycle.endDate ? now : cycle.endDate);

    const list = await this.prisma.employee.findMany({
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
      phone: e.phone,
      baseSalary: e.baseSalary,
      bankName: e.bankName,
      bankAccount: e.bankAccount,
      kycStatus: e.kycStatus,
      status: e.status,
      accrued: e.status === 'AKTIF' ? accruedWage(e.baseSalary, elapsed, cycle.totalWorkdays) : 0,
      withdrawnThisCycle: e.withdrawals.reduce((s, w) => s + w.amount, 0),
    }));
  }

  @Post('employees')
  async createEmployee(@Req() req: ReqUser, @Body() body: EmployeeInput) {
    const { employer } = await this.context(req.user);
    const data = validateEmployeeInput(body) as {
      nik: string;
      name: string;
      phone: string;
      baseSalary: number;
      bankName: string;
      bankAccount: string;
    };

    const dup = await this.prisma.employee.findUnique({ where: { nik: data.nik } });
    if (dup) throw new BadRequestException(`NIK ${data.nik} sudah terdaftar`);

    const employee = await this.prisma.employee.create({
      data: { ...data, employerId: employer.id },
    });
    await this.prisma.user.create({ data: { name: data.name, role: 'EMPLOYEE', employeeId: employee.id } });
    await this.prisma.audit(req.user.name, 'HR', 'TAMBAH_KARYAWAN', 'Employee', employee.id, `${data.name} · ${employer.name}`);
    return employee;
  }

  /** Upload massal: validasi per baris, baris valid dibuat, baris gagal dilaporkan. */
  @Post('employees/bulk')
  async bulkEmployees(@Req() req: ReqUser, @Body() body: { rows?: EmployeeInput[] }) {
    const { employer } = await this.context(req.user);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) throw new BadRequestException('Tidak ada baris data');
    if (rows.length > 500) throw new BadRequestException('Maksimal 500 baris per unggahan');

    let created = 0;
    const errors: Array<{ row: number; message: string }> = [];
    const seenNik = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      try {
        const data = validateEmployeeInput(rows[i]) as {
          nik: string;
          name: string;
          phone: string;
          baseSalary: number;
          bankName: string;
          bankAccount: string;
        };
        if (seenNik.has(data.nik)) throw new BadRequestException(`NIK ${data.nik} ganda di file`);
        seenNik.add(data.nik);
        const dup = await this.prisma.employee.findUnique({ where: { nik: data.nik } });
        if (dup) throw new BadRequestException(`NIK ${data.nik} sudah terdaftar`);

        const employee = await this.prisma.employee.create({ data: { ...data, employerId: employer.id } });
        await this.prisma.user.create({ data: { name: data.name, role: 'EMPLOYEE', employeeId: employee.id } });
        created++;
      } catch (e) {
        errors.push({ row: i + 1, message: (e as Error & { response?: { message?: string } }).response?.message || (e as Error).message });
      }
    }

    await this.prisma.audit(req.user.name, 'HR', 'UPLOAD_KARYAWAN', 'Employee', employer.id, `${created} dibuat, ${errors.length} gagal`);
    return { created, errors };
  }

  @Patch('employees/:id')
  async updateEmployee(@Req() req: ReqUser, @Param('id') id: string, @Body() body: EmployeeInput & { status?: string }) {
    const { employer } = await this.context(req.user);
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.employerId !== employer.id) throw new NotFoundException('Karyawan tidak ditemukan');

    const data = validateEmployeeInput(body, true);
    if (body.status !== undefined) {
      if (!['AKTIF', 'NONAKTIF'].includes(body.status)) throw new BadRequestException('Status harus AKTIF atau NONAKTIF');
      data.status = body.status;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Tidak ada perubahan');

    if (data.nik && data.nik !== existing.nik) {
      const dup = await this.prisma.employee.findUnique({ where: { nik: data.nik as string } });
      if (dup) throw new BadRequestException(`NIK ${data.nik} sudah terdaftar`);
    }

    const updated = await this.prisma.employee.update({ where: { id }, data });
    await this.prisma.audit(req.user.name, 'HR', 'UBAH_KARYAWAN', 'Employee', id, `${existing.name}: ${Object.keys(data).join(', ')}`);
    return updated;
  }

  /** Soft delete: nonaktifkan (resign/PHK). Ditolak jika masih ada request berjalan. */
  @Delete('employees/:id')
  async deactivateEmployee(@Req() req: ReqUser, @Param('id') id: string) {
    const { employer } = await this.context(req.user);
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.employerId !== employer.id) throw new NotFoundException('Karyawan tidak ditemukan');

    const pending = await this.prisma.withdrawal.count({
      where: { employeeId: id, status: { in: PENDING_STATUSES } },
    });
    if (pending > 0) throw new BadRequestException('Masih ada request berjalan milik karyawan ini. Selesaikan dulu.');

    const updated = await this.prisma.employee.update({ where: { id }, data: { status: 'NONAKTIF' } });
    await this.prisma.audit(req.user.name, 'HR', 'NONAKTIFKAN_KARYAWAN', 'Employee', id, existing.name);
    return updated;
  }

  // ---------- APPROVAL & PAYROLL ----------

  @Post('withdrawals/:id/decision')
  async decision(@Req() req: ReqUser, @Param('id') id: string, @Body() body: { approve?: boolean; reason?: string }) {
    const { employer } = await this.context(req.user);
    const w = await this.prisma.withdrawal.findUnique({ where: { id }, include: { employee: true } });
    if (!w || w.employerId !== employer.id) throw new NotFoundException('Request tidak ditemukan');
    if (w.status !== 'MENUNGGU_HR') throw new BadRequestException('Request sudah diproses');

    const approve = Boolean(body?.approve);
    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: approve ? 'MENUNGGU_RISK' : 'DITOLAK_HR',
        rejectReason: approve ? null : body?.reason || 'Ditolak oleh HR',
        hrDecidedAt: new Date(),
      },
    });
    await this.prisma.audit(req.user.name, 'HR', approve ? 'APPROVE_HR' : 'TOLAK_HR', 'Withdrawal', id, `${w.employee.name} · ${formatIDR(w.amount)}`);
    return updated;
  }

  @Get('report')
  async report(@Req() req: ReqUser) {
    const { cycle } = await this.context(req.user);
    const rows = await this.prisma.withdrawal.findMany({
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

    const pendingCount = await this.prisma.withdrawal.count({
      where: { cycleId: cycle.id, status: { in: PENDING_STATUSES } },
    });

    return {
      cycle: { startDate: cycle.startDate, endDate: cycle.endDate, payday: cycle.payday },
      report,
      total: report.reduce((s, r) => s + r.totalDeduction, 0),
      pendingCount,
    };
  }

  @Post('payday/close')
  async closeCycle(@Req() req: ReqUser) {
    const { employer, cycle } = await this.context(req.user);

    const pendingCount = await this.prisma.withdrawal.count({
      where: { cycleId: cycle.id, status: { in: PENDING_STATUSES } },
    });
    if (pendingCount > 0) {
      throw new BadRequestException(`Masih ada ${pendingCount} request yang belum selesai diproses. Selesaikan antrian dulu.`);
    }

    const disbursed = await this.prisma.withdrawal.findMany({
      where: { cycleId: cycle.id, status: 'DICAIRKAN', invoiceId: null },
    });
    const total = disbursed.reduce((s, w) => s + w.amount, 0);

    const result = await this.prisma.$transaction(async (tx) => {
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

    await this.prisma.audit(req.user.name, 'HR', 'TUTUP_SIKLUS', 'PayrollCycle', cycle.id, total > 0 ? `Tagihan ${formatIDR(total)} diterbitkan` : 'Tanpa tagihan');
    return result;
  }

  @Get('invoices')
  async invoices(@Req() req: ReqUser) {
    const { employer } = await this.context(req.user);
    return this.prisma.invoice.findMany({
      where: { employerId: employer.id },
      orderBy: { createdAt: 'desc' },
      include: { cycle: { select: { startDate: true, endDate: true } } },
    });
  }
}
