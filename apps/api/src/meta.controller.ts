import { Controller, Get } from '@nestjs/common';
import { formatIDR } from '@ewa/shared';
import { PrismaService } from './prisma.service';

@Controller('meta')
export class MetaController {
  constructor(private readonly prisma: PrismaService) {}

  /** Daftar user demo untuk layar login prototipe. */
  @Get('users')
  async users() {
    const users = await this.prisma.user.findMany({
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

    // HR & internal tidak lagi di sini — keduanya login via aplikasinya masing-masing (email + password).
    return { employees };
  }
}
