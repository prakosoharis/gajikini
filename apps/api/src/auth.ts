import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  Req,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from './prisma.service';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-ganti-di-produksi';
const TOKEN_TTL = '12h';

/** Peran yang punya login email+password. */
export const INTERNAL_ROLES = ['RISK', 'OPS', 'ADMIN'];
export const LOGIN_ROLES = [...INTERNAL_ROLES, 'HR'];

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  email: string | null;
  employerId: string | null;
}

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

/** Verifikasi Bearer JWT dan muat user; kelas turunan membatasi peran. */
abstract class BaseJwtGuard implements CanActivate {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly reflector: Reflector,
  ) {}

  protected abstract allowedRoles(): string[];

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Token tidak ditemukan');

    let payload: { sub: string };
    try {
      payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    } catch {
      throw new UnauthorizedException('Sesi kedaluwarsa, silakan login ulang');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !this.allowedRoles().includes(user.role)) {
      throw new UnauthorizedException('Akses ditolak untuk peran ini');
    }

    const required = this.reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()]);
    if (required && !required.includes(user.role)) {
      throw new UnauthorizedException(`Butuh peran ${required.join('/')}`);
    }

    req.user = {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      employerId: user.employerId,
    } satisfies AuthUser;
    return true;
  }
}

/** Dashboard internal: RISK / OPS / ADMIN. */
@Injectable()
export class InternalAuthGuard extends BaseJwtGuard {
  // Constructor eksplisit wajib: subclass tanpa constructor tidak mewarisi metadata DI NestJS.
  constructor(prisma: PrismaService, reflector: Reflector) {
    super(prisma, reflector);
  }
  protected allowedRoles() {
    return INTERNAL_ROLES;
  }
}

/** Portal HR employer: peran HR (terikat satu employer). */
@Injectable()
export class HrAuthGuard extends BaseJwtGuard {
  constructor(prisma: PrismaService, reflector: Reflector) {
    super(prisma, reflector);
  }
  protected allowedRoles() {
    return ['HR'];
  }
}

/** Siapa pun yang punya login (dipakai /auth/me). */
@Injectable()
export class AnyLoginGuard extends BaseJwtGuard {
  constructor(prisma: PrismaService, reflector: Reflector) {
    super(prisma, reflector);
  }
  protected allowedRoles() {
    return LOGIN_ROLES;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!email || !password) throw new BadRequestException('Email dan password wajib diisi');

    const user = await this.prisma.user.findUnique({ where: { email }, include: { employer: true } });
    if (!user || !user.passwordHash || !LOGIN_ROLES.includes(user.role)) {
      throw new UnauthorizedException('Email atau password salah');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email atau password salah');

    const token = jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, {
      expiresIn: TOKEN_TTL,
    });
    await this.prisma.audit(user.name, user.role, 'LOGIN', 'User', user.id);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        employerId: user.employerId,
        employerName: user.employer?.name ?? null,
      },
    };
  }

  @Get('me')
  @UseGuards(AnyLoginGuard)
  me(@Req() req: { user: AuthUser }) {
    return req.user;
  }
}
