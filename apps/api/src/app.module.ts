import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { DisbursementService } from './disbursement.service';
import { MetaController } from './meta.controller';
import { EmployeeController } from './employee.controller';
import { HrController } from './hr.controller';
import { InternalController } from './internal.controller';
import { AdminController } from './admin.controller';
import { AnyLoginGuard, AuthController, HrAuthGuard, InternalAuthGuard } from './auth';

@Module({
  controllers: [AuthController, MetaController, EmployeeController, HrController, InternalController, AdminController],
  providers: [PrismaService, DisbursementService, InternalAuthGuard, HrAuthGuard, AnyLoginGuard],
})
export class AppModule {}
