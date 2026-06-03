import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const orders = await this.prisma.order.findMany({
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: orders };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return { order };
  }

  async findUserOrderByEmailAndOrderId(email: string, orderId: string) {
    const user = await this.findUserByEmail(email);

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId: user.id },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Order not found for this user');
    }

    return { order };
  }

  async create(createOrderDto: CreateOrderDto) {
    const user = await this.resolveOrderUser(createOrderDto);
    const preparedItems = await Promise.all(
      createOrderDto.items.map((item) => this.prepareOrderItem(item)),
    );
    const subtotal = preparedItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const serviceFee = createOrderDto.serviceFee ?? 0;
    const deliveryFee = createOrderDto.deliveryFee ?? 0;
    const total = subtotal + serviceFee + deliveryFee;

    const order = await this.prisma.order.create({
      data: {
        userId: user.id,
        subtotal,
        serviceFee,
        deliveryFee,
        total,
        note: createOrderDto.note?.trim(),
        items: {
          create: preparedItems.map((item) => ({
            productId: item.productId,
            buyPriceId: item.buyPriceId,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
      include: this.orderInclude(),
    });

    return {
      message: 'Order created successfully.',
      order,
    };
  }

  private async resolveOrderUser(dto: CreateOrderDto) {
    if (!dto.userId && !dto.userEmail) {
      throw new BadRequestException('userId or userEmail is required');
    }

    const user = dto.userId
      ? await this.prisma.user.findUnique({ where: { id: dto.userId } })
      : await this.prisma.user.findUnique({
          where: { email: dto.userEmail?.toLowerCase().trim() },
        });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async findUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async prepareOrderItem(item: CreateOrderItemDto) {
    if (item.buyPriceId) {
      const buyPrice = await this.prisma.buyPrice.findUnique({
        where: { id: item.buyPriceId },
      });

      if (!buyPrice) {
        throw new NotFoundException('Buy price not found');
      }

      const unitPrice = this.toNumber(buyPrice.finalPrice);
      const quantity = item.quantity;

      return {
        productId: buyPrice.productId,
        buyPriceId: buyPrice.id,
        quantity,
        unit: buyPrice.unit,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    }

    if (!item.productId || !item.unit || item.unitPrice === undefined) {
      throw new BadRequestException(
        'productId, unit, and unitPrice are required when buyPriceId is not supplied',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      productId: item.productId,
      buyPriceId: undefined,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * item.quantity,
    };
  }

  private orderInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      items: {
        include: {
          product: true,
          buyPrice: true,
        },
      },
      payments: true,
    } satisfies Prisma.OrderInclude;
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
