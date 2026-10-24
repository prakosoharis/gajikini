import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { countWorkdays, feeBreakdown } from '@ewa/shared';

const prisma = new PrismaClient();

// Kredensial demo dashboard Internal Risk & Ops (lihat juga README).
const INTERNAL_USERS = [
  { name: 'Haris Prakoso', email: 'admin@gajikini.id', role: 'ADMIN', password: 'GajiKini#2026' },
  { name: 'Rina Puspita', email: 'rina@gajikini.id', role: 'RISK', password: 'GajiKini#2026' },
  { name: 'Bagas Pratama', email: 'bagas@gajikini.id', role: 'OPS', password: 'GajiKini#2026' },
];

const NAMES_A = [
  'Agus Santoso', 'Budi Hartono', 'Citra Lestari', 'Dewi Anggraini', 'Eko Prasetyo',
  'Fitri Handayani', 'Gilang Ramadhan', 'Hendra Wijaya', 'Indah Permatasari', 'Joko Susilo',
  'Kartika Sari', 'Lukman Hakim', 'Maya Puspita', 'Nur Aini', 'Oki Setiawan',
  'Putri Rahayu', 'Rudi Hermawan', 'Siti Nurhaliza', 'Taufik Hidayat', 'Umar Said',
  'Vina Melati', 'Wawan Kurniawan', 'Yanti Komala', 'Zainal Abidin', 'Rian Firmansyah',
  'Lia Amalia', 'Dodi Saputra', 'Nina Marlina', 'Asep Sunandar', 'Tri Wahyuni',
];

const NAMES_B = [
  'Andi Pratama', 'Bella Safira', 'Candra Gunawan', 'Dian Sastro', 'Erik Maulana',
  'Farah Nabila', 'Guntur Saputro', 'Hesti Purwanti', 'Irfan Bachdim', 'Juwita Sari',
  'Krisna Mukti', 'Lina Marpaung', 'Miko Ardian', 'Novi Yanti', 'Panji Wirawan',
  'Qori Islami', 'Rendi Pangestu', 'Salsa Bila', 'Tono Suratno', 'Ulfa Dwiyanti',
];

const BANKS = ['BCA', 'BRI', 'BNI', 'Mandiri', 'BTN'];

function daysAgo(n: number, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function createEmployer(opts: {
  name: string;
  sector: string;
  monthlyRevenue: number;
  facilityLimit: number;
  feeRateBps: number;
  hrName: string;
  hrEmail: string;
  hrPassword: string;
  employeeNames: string[];
  nikPrefix: string;
  phoneBase: number;
}) {
  const employer = await prisma.employer.create({
    data: {
      name: opts.name,
      sector: opts.sector,
      monthlyRevenue: opts.monthlyRevenue,
      facilityLimit: opts.facilityLimit,
      feeRateBps: opts.feeRateBps,
    },
  });

  await prisma.user.create({
    data: {
      name: opts.hrName,
      role: 'HR',
      employerId: employer.id,
      email: opts.hrEmail,
      passwordHash: await bcrypt.hash(opts.hrPassword, 10),
    },
  });

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const cycle = await prisma.payrollCycle.create({
    data: {
      employerId: employer.id,
      startDate: start,
      endDate: end,
      payday: end,
      totalWorkdays: countWorkdays(start, end),
    },
  });

  const employees = [] as Awaited<ReturnType<typeof prisma.employee.create>>[];
  for (let i = 0; i < opts.employeeNames.length; i++) {
    const name = opts.employeeNames[i];
    const baseSalary = 2_800_000 + (i % 8) * 250_000;
    const employee = await prisma.employee.create({
      data: {
        employerId: employer.id,
        nik: opts.nikPrefix + String(100 + i).padStart(10, '0'),
        name,
        phone: '08' + (opts.phoneBase + i * 137).toString(),
        baseSalary,
        bankName: BANKS[i % BANKS.length],
        bankAccount: (5500000000 + i * 911).toString(),
      },
    });
    await prisma.user.create({
      data: { name, role: 'EMPLOYEE', employeeId: employee.id },
    });
    employees.push(employee);
  }

  return { employer, cycle, employees };
}

type SeedWithdrawal = {
  empIdx: number;
  amount: number;
  status: string;
  createdDaysAgo: number;
  rejectReason?: string;
  disb?: 'SUCCESS' | 'FAILED';
};

async function seedWithdrawals(
  ctx: Awaited<ReturnType<typeof createEmployer>>,
  rows: SeedWithdrawal[],
) {
  for (const r of rows) {
    const emp = ctx.employees[r.empIdx];
    const fees = feeBreakdown(r.amount, ctx.employer.feeRateBps);
    const created = daysAgo(r.createdDaysAgo);
    const decided = daysAgo(r.createdDaysAgo, 11);

    const w = await prisma.withdrawal.create({
      data: {
        employeeId: emp.id,
        employerId: ctx.employer.id,
        cycleId: ctx.cycle.id,
        amount: r.amount,
        platformFee: fees.platformFee,
        transferFee: fees.transferFee,
        received: fees.received,
        status: r.status,
        rejectReason: r.rejectReason,
        createdAt: created,
        hrDecidedAt: ['MENUNGGU_HR'].includes(r.status) ? null : decided,
        riskDecidedAt: ['MENUNGGU_HR', 'MENUNGGU_RISK', 'DITOLAK_HR'].includes(r.status) ? null : decided,
        disbursedAt: ['DICAIRKAN', 'DILUNASI'].includes(r.status) ? decided : null,
      },
    });

    if (r.disb) {
      await prisma.disbursement.create({
        data: {
          withdrawalId: w.id,
          status: r.disb,
          attempts: r.disb === 'FAILED' ? 3 : 1,
          ref: r.disb === 'SUCCESS' ? 'TRX-SEED' + r.empIdx + ctx.employer.name.length : null,
          lastError: r.disb === 'FAILED' ? 'Mock gateway: rekening tujuan tidak merespons (simulasi)' : null,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorName: emp.name,
        actorRole: 'EMPLOYEE',
        action: 'REQUEST_PENARIKAN',
        entity: 'Withdrawal',
        entityId: w.id,
        detail: `Seed data · Rp ${r.amount.toLocaleString('id-ID')}`,
      },
    });
  }
}

async function main() {
  const existing = await prisma.employer.count();
  if (existing > 0) {
    console.log('Seed dilewati: data sudah ada.');
    return;
  }

  console.log('Menjalankan seed data...');

  const a = await createEmployer({
    name: 'PT Maju Jaya Outsourcing',
    sector: 'Outsourcing & Alih Daya',
    monthlyRevenue: 750_000_000,
    facilityLimit: 150_000_000,
    feeRateBps: 450,
    hrName: 'Sari Wulandari',
    hrEmail: 'sari@majujaya.co.id',
    hrPassword: 'GajiKini#2026',
    employeeNames: NAMES_A,
    nikPrefix: '327301',
    phoneBase: 1200000000,
  });

  const b = await createEmployer({
    name: 'PT Berkah Logistik Nusantara',
    sector: 'Logistik & Pergudangan',
    monthlyRevenue: 500_000_000,
    facilityLimit: 100_000_000,
    feeRateBps: 500,
    hrName: 'Dedi Kurniawan',
    hrEmail: 'dedi@berkahlogistik.co.id',
    hrPassword: 'GajiKini#2026',
    employeeNames: NAMES_B,
    nikPrefix: '327502',
    phoneBase: 1300000000,
  });

  for (const u of INTERNAL_USERS) {
    await prisma.user.create({
      data: { name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) },
    });
  }

  await seedWithdrawals(a, [
    { empIdx: 0, amount: 800_000, status: 'DICAIRKAN', createdDaysAgo: 6, disb: 'SUCCESS' },
    { empIdx: 1, amount: 500_000, status: 'DICAIRKAN', createdDaysAgo: 4, disb: 'SUCCESS' },
    { empIdx: 2, amount: 750_000, status: 'MENUNGGU_RISK', createdDaysAgo: 1 },
    { empIdx: 3, amount: 600_000, status: 'MENUNGGU_HR', createdDaysAgo: 0 },
    { empIdx: 4, amount: 450_000, status: 'MENUNGGU_HR', createdDaysAgo: 0 },
    { empIdx: 5, amount: 700_000, status: 'DITOLAK_HR', createdDaysAgo: 3, rejectReason: 'Melebihi kebijakan internal perusahaan' },
    { empIdx: 6, amount: 650_000, status: 'GAGAL_CAIR', createdDaysAgo: 2, disb: 'FAILED' },
  ]);

  await seedWithdrawals(b, [
    { empIdx: 0, amount: 650_000, status: 'DICAIRKAN', createdDaysAgo: 5, disb: 'SUCCESS' },
    { empIdx: 1, amount: 400_000, status: 'MENUNGGU_HR', createdDaysAgo: 0 },
  ]);

  console.log('Seed selesai: 2 employer, 50 karyawan, 9 transaksi contoh.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
