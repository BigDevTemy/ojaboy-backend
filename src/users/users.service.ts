import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      select: this.userSelect(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: users };
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
