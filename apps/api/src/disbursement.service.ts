import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { PrismaService } from './prisma.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mock payment gateway: pencairan lewat antrian BullMQ dengan retry.
 * ±20% transfer gagal secara acak untuk mensimulasikan retry + gagal final.
 */
@Injectable()
export class DisbursementService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue;
  private worker: Worker;
  private readonly MAX_ATTEMPTS = 3;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // REDIS_URL (mis. Railway: redis://default:pass@host:port) diutamakan; fallback host/port lokal.
    const url = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;
    const connection = {
      host: url?.hostname || process.env.REDIS_HOST || 'localhost',
      port: url ? Number(url.port || 6379) : Number(process.env.REDIS_PORT || 6379),
      ...(url?.password ? { password: url.password } : {}),
      ...(url?.username && url.username !== 'default' ? { username: url.username } : {}),
      // Railway private networking is IPv6-only; family 0 = dual-stack lookup.
      ...(url ? { family: 0 } : {}),
      maxRetriesPerRequest: null as null,
    };

    this.queue = new Queue('disbursement', { connection });

    this.worker = new Worker(
      'disbursement',
      async (job) => {
        const { disbursementId } = job.data as { disbursementId: string };
        await this.prisma.disbursement.update({
          where: { id: disbursementId },
          data: { attempts: { increment: 1 }, status: 'PENDING' },
        });

        // Simulasi latensi payment gateway
        await sleep(1500 + Math.random() * 2000);

        if (Math.random() < 0.2) {
          const err = 'Mock gateway: transfer ditolak sementara (simulasi)';
          await this.prisma.disbursement.update({
            where: { id: disbursementId },
            data: { lastError: err },
          });
          throw new Error(err);
        }

        const ref = 'TRX-' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
        const d = await this.prisma.disbursement.update({
          where: { id: disbursementId },
          data: { status: 'SUCCESS', ref, lastError: null },
          include: { withdrawal: { include: { employee: true } } },
        });
        await this.prisma.withdrawal.update({
          where: { id: d.withdrawalId },
          data: { status: 'DICAIRKAN', disbursedAt: new Date() },
        });
        await this.prisma.audit(
          'Sistem',
          'SYSTEM',
          'DISBURSEMENT_SUKSES',
          'Disbursement',
          disbursementId,
          `Dana cair ke ${d.withdrawal.employee.name} (${ref})`,
        );
      },
      { connection, concurrency: 3 },
    );

    this.worker.on('failed', async (job, err) => {
      if (!job) return;
      const { disbursementId } = job.data as { disbursementId: string };
      if (job.attemptsMade >= (job.opts.attempts ?? 1)) {
        await this.prisma.disbursement.update({
          where: { id: disbursementId },
          data: { status: 'FAILED', lastError: err.message },
        });
        const d = await this.prisma.disbursement.findUnique({ where: { id: disbursementId } });
        if (d) {
          await this.prisma.withdrawal.update({
            where: { id: d.withdrawalId },
            data: { status: 'GAGAL_CAIR' },
          });
          await this.prisma.audit(
            'Sistem',
            'SYSTEM',
            'DISBURSEMENT_GAGAL',
            'Disbursement',
            disbursementId,
            err.message,
          );
        }
      }
    });
  }

  async enqueue(disbursementId: string) {
    await this.queue.add(
      'cairkan',
      { disbursementId },
      { attempts: this.MAX_ATTEMPTS, backoff: { type: 'fixed', delay: 2500 } },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
