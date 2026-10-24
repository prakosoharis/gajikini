import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async audit(actorName: string, actorRole: string, action: string, entity: string, entityId: string, detail?: string) {
    await this.auditLog.create({
      data: { actorName, actorRole, action, entity, entityId, detail },
    });
  }
}
