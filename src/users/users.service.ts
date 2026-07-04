import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UserListQueryDto } from './dto/user-list-query.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actor: AuthUser,
    query: UserListQueryDto = new UserListQueryDto(),
  ) {
    this.assertAdmin(actor);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const role = query.role ?? 'user';

    const where: Prisma.UserWhereInput = {
      role,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          ...this.userSelect(),
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map(({ _count, ...user }) => ({
        ...user,
        orderCount: _count.orders,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  async findOrdersByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: {
        ...this.userSelect(),
        orders: {
          include: this.orderInclude(),
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      user,
      orders: user.orders,
    };
  }

  async findLastOrderByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.prisma.order.findFirst({
      where: { userId: user.id },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    if (!order) {
      throw new NotFoundException('No orders found for this user');
    }

    return { user, order };
  }

  private assertAdmin(user: AuthUser) {
    if (!['admin', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('Only admins can view customer accounts');
    }
  }

  private normalizeEmail(email: string) {
    return email.toLowerCase().trim();
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      authProviders: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }

  private orderInclude() {
    return {
      items: {
        include: {
          product: true,
          buyPrice: true,
        },
      },
      payments: true,
      feedback: true,
    } satisfies Prisma.OrderInclude;
  }
}
