# GajiKini — Prototipe Earned Wage Access (EWA)

Prototipe platform EWA model B2B2C sesuai PRD: karyawan menarik sebagian gaji yang sudah
diakru sebelum payday, dengan dua lapis persetujuan (HR → risk analyst) dan repayment
lewat potong gaji oleh employer.

## Demo publik (Vercel + Neon)

Produksi: **https://gajikini.vercel.app** — web + API jadi satu project Vercel
(API di-port ke Next.js route handlers di `apps/web/app/api`), database PostgreSQL di Neon
(project `gajikini`, region Singapura). Antrian BullMQ diganti *lazy resolution*:
disbursement PENDING diselesaikan saat endpoint polling dipanggil (`lib/server/core.ts`).

Deploy ulang: `vercel deploy --prod` dari root repo (root directory project = `apps/web`).

## Menjalankan (Docker)

```bash
docker compose up --build
```

| Layanan | URL |
| --- | --- |
| Web karyawan (demo tanpa password; cikal bakal aplikasi React Native) | http://localhost:3020 |
| **Aplikasi Internal Risk & Ops** (login email+password) | http://localhost:3021 |
| **Portal HR Employer** (login email+password per perusahaan) | http://localhost:3022 |
| API (NestJS) | http://localhost:4000 |
| PostgreSQL | internal container (ewa/ewa, tidak dipublikasikan ke host) |

Seed otomatis saat API pertama kali jalan: 2 employer, 50 karyawan, 9 transaksi contoh.

## Aplikasi Internal Risk & Ops (apps/internal)

Aplikasi Next.js terpisah dengan autentikasi sungguhan: JWT dari API disimpan di cookie
httpOnly lewat BFF proxy (`/api/be/*`), middleware memproteksi semua rute. Fitur: ringkasan
portofolio, antrian approval risk, monitor disbursement + retry, tagihan, **CRUD employer**
(buat + siklus otomatis, edit, suspend, nonaktif — dengan validasi limit ≤ 20% revenue),
**CRUD user internal** (khusus ADMIN), dan audit log.

Akun demo (di-seed, lihat `apps/api/src/seed.ts` konstanta `INTERNAL_USERS`):

| Email | Role |
| --- | --- |
| admin@gajikini.id | ADMIN |
| rina@gajikini.id | RISK |
| bagas@gajikini.id | OPS |

Password ketiganya sama — nilai `password` di konstanta `INTERNAL_USERS` pada seed.

## Portal HR Employer (apps/hr)

Aplikasi Next.js terpisah (arsitektur sama: BFF proxy + cookie httpOnly `gk_hr_session`,
middleware). Fitur: ringkasan, approval pertama, **CRUD karyawan** (tambah manual dengan
validasi NIK/HP/rekening, edit, nonaktifkan untuk resign/PHK) + **upload massal CSV**
(template tersedia, laporan error per baris), laporan potong gaji + tutup siklus, tagihan.

Akun demo HR (di-seed, password sama dengan akun internal):

| Email | Perusahaan |
| --- | --- |
| sari@majujaya.co.id | PT Maju Jaya Outsourcing |
| dedi@berkahlogistik.co.id | PT Berkah Logistik Nusantara |

Rencana berikutnya: aplikasi karyawan (React Native).

## Skenario demo end-to-end

1. **Karyawan** (mis. Dewi Anggraini) → lihat limit → "Tarik Gaji" → kirim request.
2. **HR** (Sari Wulandari) → tab Approval → Setujui (approval pertama).
3. **Internal** (Rina Puspita) → Antrian Risk → "Setujui & Cairkan" (approval kedua).
4. Tab **Disbursement**: mock payment gateway memproses via antrian BullMQ
   (±20% gagal acak → retry otomatis 3x; gagal final bisa di-Retry manual).
5. Kembali ke **Karyawan**: status berubah jadi "Dicairkan".
6. **HR** → Laporan Potong Gaji → "Tutup Siklus Payroll" → tagihan repayment terbit,
   siklus bulan berikutnya terbuka.
7. **Internal** → Tagihan → "Tandai Dibayar" → penarikan berstatus "Lunas".

## Struktur

```
packages/shared   # mesin akrual, limit & fee (pure functions, dipakai API + web)
apps/api          # NestJS + Prisma + BullMQ (Postgres, Redis)
apps/web          # Next.js: aplikasi karyawan (frame HP), portal HR, dashboard internal
```

## Pengembangan lokal tanpa Docker

```bash
pnpm install
docker compose up db redis -d
DATABASE_URL=postgresql://ewa:ewa@localhost:5432/ewa pnpm --filter api exec prisma db push
pnpm -r build
DATABASE_URL=postgresql://ewa:ewa@localhost:5432/ewa node apps/api/dist/seed.js
DATABASE_URL=postgresql://ewa:ewa@localhost:5432/ewa node apps/api/dist/main.js   # port 4000
pnpm --filter web dev                                                             # port 3000
```

## Catatan prototipe (bukan produksi)

- Login mock via header `x-user-id` — produksi memakai OTP + PIN + JWT (lihat PRD §17).
- KYC, payment gateway, dan WhatsApp di-mock; tukar dengan vendor asli di Fase 0/1.
- Aplikasi karyawan dirender sebagai web frame HP; versi produksi memakai React Native (Expo).
