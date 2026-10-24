import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
} from '@nestjs/common';
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
import { PrismaService } from './prisma.service';

@Controller('employee')
export class EmployeeController {
  constructor(private readonly prisma: PrismaService) {}

  private async context(userId: string) {
    if (!userId) throw new BadRequestException('Header x-user-id wajib diisi');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { employee: { include: { employer: true } } },
    });
    if (!user || !user.employee) throw new NotFoundException('User karyawan tidak ditemukan');
    const cycle = await this.prisma.payrollCycle.findFirst({
      where: { employerId: user.employee.employerId, status: 'AKTIF' },
      orderBy: { startDate: 'desc' },
    });
    if (!cycle) throw new NotFoundException('Tidak ada siklus payroll aktif');
    return { user, employee: user.employee, employer: user.employee.employer, cycle };
  }

  private async limitFor(employeeId: string, employerId: string, cycle: { id: string; startDate: Date; endDate: Date; totalWorkdays: number }, baseSalary: number, facilityLimit: number) {
    const now = new Date();
    const elapsed = countWorkdays(cycle.startDate, now < cycle.endDate ? now : cycle.endDate);
    const accrued = accruedWage(baseSalary, elapsed, cycle.totalWorkdays);

    const activeAgg = await this.prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: { employeeId, cycleId: cycle.id, status: { in: ACTIVE_STATUSES } },
    });
    const outstandingAgg = await this.prisma.withdrawal.aggregate({
      _sum: { amount: true },
      where: { employerId, status: { in: OUTSTANDING_STATUSES } },
    });
    const activeWithdrawn = activeAgg._sum.amount ?? 0;
    const outstanding = outstandingAgg._sum.amount ?? 0;
    const employerRemaining = Math.max(0, facilityLimit - outstanding);
    const limit = availableLimit(accrued, activeWithdrawn, employerRemaining);
    return { elapsed, accrued, activeWithdrawn, employerRemaining, limit };
  }

  /**
   * Login karyawan via nomor HP (aplikasi mobile).
   * OTP masih mock untuk demo: 6 digit apa pun diterima — produksi memakai OTP WhatsApp/SMS sungguhan.
   */
  @Post('login')
  async login(@Body() body: { phone?: string; otp?: string }) {
    const phone = String(body?.phone || '').trim();
    const otp = String(body?.otp || '').trim();
    if (!/^08\d{8,12}$/.test(phone)) throw new BadRequestException('Nomor HP harus format 08xxxxxxxxxx');
    if (!/^\d{6}$/.test(otp)) throw new BadRequestException('Kode OTP harus 6 digit');

    const employee = await this.prisma.employee.findFirst({
      where: { phone },
      include: { employer: true, user: true },
    });
    if (!employee || !employee.user) throw new NotFoundException('Nomor HP tidak terdaftar. Hubungi HR perusahaan Anda.');
    if (employee.status !== 'AKTIF') throw new BadRequestException('Status kepegawaian Anda tidak aktif. Hubungi HR Anda.');

    await this.prisma.audit(employee.name, 'EMPLOYEE', 'LOGIN_MOBILE', 'Employee', employee.id, employee.employer.name);
    return {
      userId: employee.user.id,
      name: employee.name,
      employerName: employee.employer.name,
    };
  }

  @Get('summary')
  async summary(@Headers('x-user-id') userId: string) {
    const { employee, employer, cycle } = await this.context(userId);
    const calc = await this.limitFor(employee.id, employer.id, cycle, employee.baseSalary, employer.facilityLimit);

    const withdrawals = await this.prisma.withdrawal.findMany({
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

  @Post('withdrawals')
  async create(@Headers('x-user-id') userId: string, @Body() body: { amount?: number }) {
    const { user, employee, employer, cycle } = await this.context(userId);
    const amount = Math.floor(Number(body?.amount));

    if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL) {
      throw new BadRequestException(`Nominal penarikan minimal ${formatIDR(MIN_WITHDRAWAL)}`);
    }

    if (employer.status !== 'AKTIF') {
      throw new BadRequestException('Fasilitas EWA perusahaan sedang ditangguhkan. Hubungi HR Anda.');
    }
    if (employee.status !== 'AKTIF') {
      throw new BadRequestException('Status kepegawaian Anda tidak aktif. Hubungi HR Anda.');
    }

    const pending = await this.prisma.withdrawal.findFirst({
      where: { employeeId: employee.id, status: { in: PENDING_STATUSES } },
    });
    if (pending) {
      throw new BadRequestException('Masih ada request yang sedang diproses. Tunggu sampai selesai.');
    }

    const calc = await this.limitFor(employee.id, employer.id, cycle, employee.baseSalary, employer.facilityLimit);
    if (amount > calc.limit) {
      throw new BadRequestException(`Nominal melebihi limit tersedia (${formatIDR(calc.limit)})`);
    }

    const fees = feeBreakdown(amount, employer.feeRateBps);
    const w = await this.prisma.withdrawal.create({
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
    await this.prisma.audit(user.name, 'EMPLOYEE', 'REQUEST_PENARIKAN', 'Withdrawal', w.id, `${formatIDR(amount)} oleh ${employee.name}`);
    return w;
  }
}
