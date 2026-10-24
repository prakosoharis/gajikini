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
import * as bcrypt from 'bcryptjs';
import { OUTSTANDING_STATUSES, countWorkdays, formatIDR } from '@ewa/shared';
import { PrismaService } from './prisma.service';
import { AuthUser, INTERNAL_ROLES, InternalAuthGuard, Roles } from './auth';

type ReqUser = { user: AuthUser };

const EMPLOYER_STATUSES = ['AKTIF', 'SUSPEND', 'NONAKTIF'];

/** CRUD employer + user internal — bagian dari dashboard Internal Risk & Ops. */
@Controller('internal')
@UseGuards(InternalAuthGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- EMPLOYER CRUD ----------

  @Get('employers')
  async employers() {
    const list = await this.prisma.employer.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: { name: 'asc' },
    });
    const result = [];
    for (const e of list) {
      const agg = await this.prisma.withdrawal.aggregate({
        _sum: { amount: true },
        where: { employerId: e.id, status: { in: OUTSTANDING_STATUSES } },
      });
      const outstanding = agg._sum.amount ?? 0;
      result.push({
        id: e.id,
        name: e.name,
        sector: e.sector,
        monthlyRevenue: e.monthlyRevenue,
        facilityLimit: e.facilityLimit,
        feeRateBps: e.feeRateBps,
        status: e.status,
        employees: e._count.employees,
        outstanding,
        utilization: e.facilityLimit ? outstanding / e.facilityLimit : 0,
      });
    }
    return result;
  }

  @Get('employers/:id')
  async employerDetail(@Param('id') id: string) {
    const e = await this.prisma.employer.findUnique({
      where: { id },
      include: {
        employees: { orderBy: { name: 'asc' } },
        cycles: { orderBy: { startDate: 'desc' }, take: 3 },
        invoices: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!e) throw new NotFoundException('Employer tidak ditemukan');
    const [outstandingAgg, withdrawals] = await Promise.all([
      this.prisma.withdrawal.aggregate({
        _sum: { amount: true },
        where: { employerId: id, status: { in: OUTSTANDING_STATUSES } },
      }),
      this.prisma.withdrawal.findMany({
        where: { employerId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { employee: { select: { name: true } } },
      }),
    ]);
    const outstanding = outstandingAgg._sum.amount ?? 0;
    return {
      ...e,
      outstanding,
      utilization: e.facilityLimit ? outstanding / e.facilityLimit : 0,
      recentWithdrawals: withdrawals,
    };
  }

  @Post('employers')
  async createEmployer(
    @Req() req: ReqUser,
    @Body()
    body: {
      name?: string;
      sector?: string;
      monthlyRevenue?: number;
      facilityLimit?: number;
      feeRateBps?: number;
    },
  ) {
    const name = String(body?.name || '').trim();
    const sector = String(body?.sector || '').trim();
    const monthlyRevenue = Math.floor(Number(body?.monthlyRevenue));
    const facilityLimit = Math.floor(Number(body?.facilityLimit));
    const feeRateBps = Math.floor(Number(body?.feeRateBps));

    if (name.length < 3) throw new BadRequestException('Nama perusahaan minimal 3 karakter');
    if (!sector) throw new BadRequestException('Sektor wajib diisi');
    if (!Number.isFinite(monthlyRevenue) || monthlyRevenue <= 0) throw new BadRequestException('Revenue bulanan tidak valid');
    if (!Number.isFinite(facilityLimit) || facilityLimit <= 0) throw new BadRequestException('Limit fasilitas tidak valid');
    if (facilityLimit > monthlyRevenue * 0.2) {
      throw new BadRequestException(`Limit fasilitas melebihi 20% revenue bulanan (maks. ${formatIDR(Math.floor(monthlyRevenue * 0.2))})`);
    }
    if (!Number.isFinite(feeRateBps) || feeRateBps < 100 || feeRateBps > 1000) {
      throw new BadRequestException('Fee rate harus 100–1000 bps (1–10%)');
    }

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const employer = await this.prisma.employer.create({
      data: {
        name,
        sector,
        monthlyRevenue,
        facilityLimit,
        feeRateBps,
        cycles: {
          create: { startDate: start, endDate: end, payday: end, totalWorkdays: countWorkdays(start, end) },
        },
      },
    });
    await this.prisma.audit(req.user.name, req.user.role, 'BUAT_EMPLOYER', 'Employer', employer.id, name);
    return employer;
  }

  @Patch('employers/:id')
  async updateEmployer(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      sector: string;
      monthlyRevenue: number;
      facilityLimit: number;
      feeRateBps: number;
      status: string;
    }>,
  ) {
    const existing = await this.prisma.employer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employer tidak ditemukan');

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (String(body.name).trim().length < 3) throw new BadRequestException('Nama minimal 3 karakter');
      data.name = String(body.name).trim();
    }
    if (body.sector !== undefined) data.sector = String(body.sector).trim();
    if (body.monthlyRevenue !== undefined) {
      const v = Math.floor(Number(body.monthlyRevenue));
      if (!Number.isFinite(v) || v <= 0) throw new BadRequestException('Revenue bulanan tidak valid');
      data.monthlyRevenue = v;
    }
    if (body.facilityLimit !== undefined) {
      const v = Math.floor(Number(body.facilityLimit));
      const rev = (data.monthlyRevenue as number) ?? existing.monthlyRevenue;
      if (!Number.isFinite(v) || v <= 0) throw new BadRequestException('Limit fasilitas tidak valid');
      if (v > rev * 0.2) throw new BadRequestException(`Limit melebihi 20% revenue (maks. ${formatIDR(Math.floor(rev * 0.2))})`);
      data.facilityLimit = v;
    }
    if (body.feeRateBps !== undefined) {
      const v = Math.floor(Number(body.feeRateBps));
      if (!Number.isFinite(v) || v < 100 || v > 1000) throw new BadRequestException('Fee rate harus 100–1000 bps');
      data.feeRateBps = v;
    }
    if (body.status !== undefined) {
      if (!EMPLOYER_STATUSES.includes(body.status)) throw new BadRequestException(`Status harus salah satu: ${EMPLOYER_STATUSES.join(', ')}`);
      data.status = body.status;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Tidak ada perubahan');

    const updated = await this.prisma.employer.update({ where: { id }, data });
    await this.prisma.audit(req.user.name, req.user.role, 'UBAH_EMPLOYER', 'Employer', id, JSON.stringify(Object.keys(data)));
    return updated;
  }

  /** Soft delete: nonaktifkan employer (riwayat transaksi tetap tersimpan). */
  @Delete('employers/:id')
  async deactivateEmployer(@Req() req: ReqUser, @Param('id') id: string) {
    const existing = await this.prisma.employer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Employer tidak ditemukan');
    const outstanding = await this.prisma.withdrawal.count({
      where: { employerId: id, status: { in: OUTSTANDING_STATUSES } },
    });
    if (outstanding > 0) {
      throw new BadRequestException(`Masih ada ${outstanding} penarikan outstanding. Lunasi dulu sebelum menonaktifkan.`);
    }
    const updated = await this.prisma.employer.update({ where: { id }, data: { status: 'NONAKTIF' } });
    await this.prisma.audit(req.user.name, req.user.role, 'NONAKTIFKAN_EMPLOYER', 'Employer', id, existing.name);
    return updated;
  }

  // ---------- USER INTERNAL CRUD (khusus ADMIN) ----------

  @Get('users')
  @Roles('ADMIN')
  async users() {
    return this.prisma.user.findMany({
      where: { role: { in: INTERNAL_ROLES } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  @Post('users')
  @Roles('ADMIN')
  async createUser(
    @Req() req: ReqUser,
    @Body() body: { name?: string; email?: string; password?: string; role?: string },
  ) {
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const role = String(body?.role || '');

    if (name.length < 3) throw new BadRequestException('Nama minimal 3 karakter');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new BadRequestException('Email tidak valid');
    if (password.length < 8) throw new BadRequestException('Password minimal 8 karakter');
    if (!INTERNAL_ROLES.includes(role)) throw new BadRequestException(`Role harus salah satu: ${INTERNAL_ROLES.join(', ')}`);

    const dup = await this.prisma.user.findUnique({ where: { email } });
    if (dup) throw new BadRequestException('Email sudah terdaftar');

    const user = await this.prisma.user.create({
      data: { name, email, role, passwordHash: await bcrypt.hash(password, 10) },
      select: { id: true, name: true, email: true, role: true },
    });
    await this.prisma.audit(req.user.name, req.user.role, 'BUAT_USER', 'User', user.id, `${name} (${role})`);
    return user;
  }

  @Patch('users/:id')
  @Roles('ADMIN')
  async updateUser(
    @Req() req: ReqUser,
    @Param('id') id: string,
    @Body() body: Partial<{ name: string; role: string; password: string }>,
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || !INTERNAL_ROLES.includes(existing.role)) throw new NotFoundException('User internal tidak ditemukan');

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (String(body.name).trim().length < 3) throw new BadRequestException('Nama minimal 3 karakter');
      data.name = String(body.name).trim();
    }
    if (body.role !== undefined) {
      if (!INTERNAL_ROLES.includes(body.role)) throw new BadRequestException(`Role harus salah satu: ${INTERNAL_ROLES.join(', ')}`);
      if (id === req.user.id && body.role !== 'ADMIN') throw new BadRequestException('Tidak bisa menurunkan role sendiri');
      data.role = body.role;
    }
    if (body.password !== undefined) {
      if (String(body.password).length < 8) throw new BadRequestException('Password minimal 8 karakter');
      data.passwordHash = await bcrypt.hash(String(body.password), 10);
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Tidak ada perubahan');

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true },
    });
    await this.prisma.audit(req.user.name, req.user.role, 'UBAH_USER', 'User', id, JSON.stringify(Object.keys(data)));
    return user;
  }

  @Delete('users/:id')
  @Roles('ADMIN')
  async deleteUser(@Req() req: ReqUser, @Param('id') id: string) {
    if (id === req.user.id) throw new BadRequestException('Tidak bisa menghapus akun sendiri');
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing || !INTERNAL_ROLES.includes(existing.role)) throw new NotFoundException('User internal tidak ditemukan');
    await this.prisma.user.delete({ where: { id } });
    await this.prisma.audit(req.user.name, req.user.role, 'HAPUS_USER', 'User', id, existing.name);
    return { ok: true };
  }
}
