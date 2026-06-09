import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PriceUnit, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';

type PreparedOrderItem = {
  productId: string;
  buyPriceId: string;
  marketId: string | null;
  productName: string;
  quantity: number;
  unit: PriceUnit;
  unitPrice: number;
  totalPrice: number;
  currency: string;
};

type OrderQuote = {
  items: PreparedOrderItem[];
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  currency: string;
  deliveryZoneId?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

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

  async quote(dto: QuoteOrderDto) {
    const quote = await this.calculateQuote(dto);

    return {
      message: 'Order quote calculated successfully.',
      quote,
    };
  }

  async create(dto: CreateOrderDto) {
    const email = dto.email.toLowerCase().trim();
    const quote = await this.calculateQuote(dto);
    const tokenHash = this.hashToken(dto.orderToken);

    const order = await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.orderOtpChallenge.findUnique({
        where: { orderTokenHash: tokenHash },
      });

      if (
        !challenge ||
        challenge.email !== email ||
        !challenge.verifiedAt ||
        !challenge.orderTokenExpiresAt ||
        challenge.orderTokenExpiresAt.getTime() < Date.now() ||
        challenge.consumedAt
      ) {
        throw new UnauthorizedException(
          'Order token is invalid, expired, or already used',
        );
      }

      const consumed = await tx.orderOtpChallenge.updateMany({
        where: {
          id: challenge.id,
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new UnauthorizedException('Order token has already been used');
      }

      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        if (!challenge.fullName) {
          throw new BadRequestException(
            'A full name is required to create this order',
          );
        }

        user = await tx.user.create({
          data: {
            email,
            fullName: challenge.fullName,
            authProviders: [],
          },
        });
      }

      return tx.order.create({
        data: {
          userId: user.id,
          subtotal: quote.subtotal,
          serviceFee: quote.serviceFee,
          deliveryFee: quote.deliveryFee,
          total: quote.total,
          note: dto.note?.trim(),
          items: {
            create: quote.items.map((item) => ({
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
    });

    return {
      message: 'Order created successfully.',
      order,
    };
  }

  private async calculateQuote(dto: QuoteOrderDto): Promise<OrderQuote> {
    const buyPriceIds = [...new Set(dto.items.map((item) => item.buyPriceId))];
    const buyPrices = await this.prisma.buyPrice.findMany({
      where: { id: { in: buyPriceIds } },
      include: { product: true },
    });
    const buyPriceById = new Map(
      buyPrices.map((buyPrice) => [buyPrice.id, buyPrice]),
    );
    const now = new Date();

    const items = dto.items.map((item): PreparedOrderItem => {
      const buyPrice = buyPriceById.get(item.buyPriceId);

      if (!buyPrice) {
        throw new NotFoundException(
          `Buy price ${item.buyPriceId} was not found`,
        );
      }

      if (
        !buyPrice.isActive ||
        buyPrice.validFrom > now ||
        (buyPrice.validUntil && buyPrice.validUntil < now)
      ) {
        throw new BadRequestException(
          `Buy price ${item.buyPriceId} is not currently available`,
        );
      }

      const unitPrice = this.toNumber(buyPrice.finalPrice);

      return {
        productId: buyPrice.productId,
        buyPriceId: buyPrice.id,
        marketId: buyPrice.marketId,
        productName: buyPrice.product.name,
        quantity: item.quantity,
        unit: buyPrice.unit,
        unitPrice,
        totalPrice: this.roundMoney(unitPrice * item.quantity),
        currency: buyPrice.currency,
      };
    });

    const currencies = new Set(items.map((item) => item.currency));

    if (currencies.size !== 1) {
      throw new BadRequestException(
        'All order items must use the same currency',
      );
    }

    const subtotal = this.roundMoney(
      items.reduce((sum, item) => sum + item.totalPrice, 0),
    );
    const serviceFee = this.roundMoney(
      subtotal * (this.getServiceFeePercent() / 100),
    );
    const deliveryFee = await this.calculateDeliveryFee(
      items,
      dto.deliveryZoneId,
    );

    return {
      items,
      subtotal,
      serviceFee,
      deliveryFee,
      total: this.roundMoney(subtotal + serviceFee + deliveryFee),
      currency: items[0].currency,
      deliveryZoneId: dto.deliveryZoneId,
    };
  }

  private async calculateDeliveryFee(
    items: PreparedOrderItem[],
    deliveryZoneId?: string,
  ): Promise<number> {
    if (!deliveryZoneId) {
      return 0;
    }

    const marketIds = [
      ...new Set(items.map((item) => item.marketId).filter(Boolean)),
    ] as string[];

    if (marketIds.length === 0) {
      throw new BadRequestException(
        'Delivery cannot be quoted because the selected prices have no market',
      );
    }

    const deliveryCosts = await this.prisma.marketDeliveryCost.findMany({
      where: {
        deliveryZoneId,
        marketId: { in: marketIds },
        isActive: true,
      },
    });

    if (deliveryCosts.length !== marketIds.length) {
      throw new BadRequestException(
        'Delivery is not available from every selected market to this zone',
      );
    }

    return this.roundMoney(
      deliveryCosts.reduce(
        (sum, deliveryCost) => sum + this.toNumber(deliveryCost.cost),
        0,
      ),
    );
  }

  private getServiceFeePercent(): number {
    const percent = Number(
      this.configService.get<string>('ORDER_SERVICE_FEE_PERCENT') ?? 0,
    );

    if (!Number.isFinite(percent) || percent < 0) {
      throw new BadRequestException(
        'ORDER_SERVICE_FEE_PERCENT must be a non-negative number',
      );
    }

    return percent;
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

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
