import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CouponDiscountType, PriceUnit, Prisma, User } from '@prisma/client';
import { createHash } from 'node:crypto';
import { EmailService } from '../mail/email.service';
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
  discountAmount: number;
  serviceFee: number;
  serviceFeeRuleId?: string;
  serviceFeePercentage: number;
  serviceFeeBase: number;
  deliveryFee: number;
  total: number;
  currency: string;
  deliveryZoneId?: string;
  promotionId?: string;
  promotionName?: string;
  promotionDiscount: number;
  couponId?: string;
  couponCode?: string;
  couponDiscount: number;
};

type QuoteCustomer = Pick<User, 'id' | 'email'>;

type DatabaseClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
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
    const customer = dto.customerEmail
      ? await this.prisma.user.findUnique({
          where: { email: dto.customerEmail.toLowerCase().trim() },
          select: { id: true, email: true },
        })
      : null;
    const quote = await this.calculateQuote(dto, customer ?? undefined);

    return {
      message: 'Order quote calculated successfully.',
      quote,
    };
  }

  async create(dto: CreateOrderDto) {
    const email = dto.email.toLowerCase().trim();
    const tokenHash = this.hashToken(dto.orderToken);

    const { order, quote } = await this.prisma.$transaction(
      async (tx) => {
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

        const quote = await this.calculateQuote(
          dto,
          { id: user.id, email: user.email },
          tx,
        );
        const order = await tx.order.create({
          data: {
            userId: user.id,
            serviceFeeRuleId: quote.serviceFeeRuleId,
            promotionId: quote.promotionId,
            couponId: quote.couponId,
            subtotal: quote.subtotal,
            discountAmount: quote.discountAmount,
            promotionDiscount: quote.promotionDiscount,
            couponDiscount: quote.couponDiscount,
            serviceFee: quote.serviceFee,
            serviceFeePercentage: quote.serviceFeePercentage,
            serviceFeeBase: quote.serviceFeeBase,
            deliveryFee: quote.deliveryFee,
            total: quote.total,
            couponCode: quote.couponCode,
            promotionName: quote.promotionName,
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

        if (quote.couponId && quote.couponDiscount > 0) {
          await tx.couponRedemption.create({
            data: {
              couponId: quote.couponId,
              userId: user.id,
              orderId: order.id,
              discountAmount: quote.couponDiscount,
            },
          });
        }

        return { order, quote };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    try {
      await this.emailService.sendTemplateEmail({
        to: order.user.email,
        template: 'order-status',
        variables: {
          fullName: order.user.fullName,
          orderNumber: order.id,
          orderStatus: order.status,
          orderMessage:
            'Your order has been received successfully and is awaiting processing.',
          orderItems: order.items.map((item) => ({
            productName: item.product.name,
            quantity: this.toNumber(item.quantity).toString(),
            unit: item.unit.replace(/_/g, ' '),
            unitPrice: this.formatMoney(
              this.toNumber(item.unitPrice),
              quote.currency,
            ),
            totalPrice: this.formatMoney(
              this.toNumber(item.totalPrice),
              quote.currency,
            ),
          })),
          subtotal: this.formatMoney(
            this.toNumber(order.subtotal),
            quote.currency,
          ),
          serviceFee: this.formatMoney(
            this.toNumber(order.serviceFee),
            quote.currency,
          ),
          discountAmount:
            this.toNumber(order.discountAmount) > 0
              ? this.formatMoney(
                  this.toNumber(order.discountAmount),
                  quote.currency,
                )
              : '',
          deliveryFee: this.formatMoney(
            this.toNumber(order.deliveryFee),
            quote.currency,
          ),
          total: this.formatMoney(this.toNumber(order.total), quote.currency),
          note: order.note ?? '',
        },
      });
    } catch (error) {
      this.logger.error(
        `Order ${order.id} was created, but its confirmation email could not be sent`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      message: 'Order created successfully.',
      order,
    };
  }

  private async calculateQuote(
    dto: QuoteOrderDto,
    customer?: QuoteCustomer,
    db: DatabaseClient = this.prisma,
  ): Promise<OrderQuote> {
    const buyPriceIds = [...new Set(dto.items.map((item) => item.buyPriceId))];
    const buyPrices = await db.buyPrice.findMany({
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
    const promotion = await this.calculatePromotionDiscount(subtotal, db);
    const coupon = await this.calculateCouponDiscount(
      dto.couponCode,
      subtotal,
      customer,
      db,
    );
    const discounts = this.resolveAppliedDiscounts(subtotal, promotion, coupon);
    const discountedSubtotal = this.roundMoney(
      Math.max(0, subtotal - discounts.discountAmount),
    );
    const fee = await this.calculateServiceFee(
      discountedSubtotal,
      items[0].currency,
      db,
    );
    const deliveryFee = await this.calculateDeliveryFee(
      items,
      dto.deliveryZoneId,
      db,
    );

    return {
      items,
      subtotal,
      discountAmount: discounts.discountAmount,
      promotionId: discounts.promotion.promotionId,
      promotionName: discounts.promotion.promotionName,
      promotionDiscount: discounts.promotion.discountAmount,
      couponId: discounts.coupon.couponId,
      couponCode: discounts.coupon.couponCode,
      couponDiscount: discounts.coupon.discountAmount,
      serviceFee: fee.amount,
      serviceFeeRuleId: fee.rule?.id,
      serviceFeePercentage: fee.percentage,
      serviceFeeBase: fee.baseFee,
      deliveryFee,
      total: this.roundMoney(discountedSubtotal + fee.amount + deliveryFee),
      currency: items[0].currency,
      deliveryZoneId: dto.deliveryZoneId,
    };
  }

  private async calculateDeliveryFee(
    items: PreparedOrderItem[],
    deliveryZoneId?: string,
    db: DatabaseClient = this.prisma,
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

    const deliveryCosts = await db.marketDeliveryCost.findMany({
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

  private async calculateServiceFee(
    chargeableSubtotal: number,
    currency: string,
    db: DatabaseClient,
  ) {
    const now = new Date();
    const rule = await db.serviceFeeRule.findFirst({
      where: {
        isActive: true,
        currency,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (!rule) {
      const percentage = this.getFallbackServiceFeePercent();
      return {
        amount: this.roundMoney(chargeableSubtotal * (percentage / 100)),
        percentage,
        baseFee: 0,
        rule: undefined,
      };
    }

    const percentage = this.toNumber(rule.percentage);
    const baseFee = this.toNumber(rule.baseFee);
    const minimumFee =
      rule.minimumFee === null ? undefined : this.toNumber(rule.minimumFee);
    const maximumFee =
      rule.maximumFee === null ? undefined : this.toNumber(rule.maximumFee);
    let amount = baseFee + chargeableSubtotal * (percentage / 100);

    if (minimumFee !== undefined) {
      amount = Math.max(amount, minimumFee);
    }

    if (maximumFee !== undefined) {
      amount = Math.min(amount, maximumFee);
    }

    return {
      amount: this.roundMoney(amount),
      percentage,
      baseFee,
      rule,
    };
  }

  private async calculateCouponDiscount(
    code: string | undefined,
    subtotal: number,
    customer: QuoteCustomer | undefined,
    db: DatabaseClient,
  ) {
    if (!code?.trim()) {
      return { discountAmount: 0 };
    }

    const normalizedCode = code.trim().toUpperCase();
    const now = new Date();
    const coupon = await db.coupon.findUnique({
      where: { code: normalizedCode },
      include: {
        eligibleCustomers: { select: { userId: true } },
        _count: { select: { redemptions: true } },
      },
    });

    if (
      !coupon ||
      !coupon.isActive ||
      coupon.validFrom > now ||
      (coupon.validUntil && coupon.validUntil < now)
    ) {
      throw new BadRequestException('Coupon is invalid or expired');
    }

    if (subtotal < this.toNumber(coupon.minimumSubtotal)) {
      throw new BadRequestException(
        `Coupon requires a minimum subtotal of ${this.toNumber(coupon.minimumSubtotal)}`,
      );
    }

    if (
      coupon.usageLimit !== null &&
      coupon._count.redemptions >= coupon.usageLimit
    ) {
      throw new BadRequestException('Coupon usage limit has been reached');
    }

    if (coupon.eligibleCustomers.length > 0) {
      if (!customer) {
        throw new BadRequestException(
          'Customer email is required for this coupon',
        );
      }

      if (
        !coupon.eligibleCustomers.some(
          (eligible) => eligible.userId === customer.id,
        )
      ) {
        throw new BadRequestException(
          'This coupon is not available for this customer',
        );
      }
    }

    if (customer) {
      const customerUsage = await db.couponRedemption.count({
        where: { couponId: coupon.id, userId: customer.id },
      });

      if (customerUsage >= coupon.perCustomerLimit) {
        throw new BadRequestException(
          'This customer has reached the coupon usage limit',
        );
      }
    }

    let discountAmount =
      coupon.discountType === CouponDiscountType.percentage
        ? subtotal * (this.toNumber(coupon.discountValue) / 100)
        : this.toNumber(coupon.discountValue);

    if (coupon.maximumDiscount !== null) {
      discountAmount = Math.min(
        discountAmount,
        this.toNumber(coupon.maximumDiscount),
      );
    }

    return {
      couponId: coupon.id,
      couponCode: coupon.code,
      discountAmount: this.roundMoney(Math.min(subtotal, discountAmount)),
    };
  }

  private async calculatePromotionDiscount(
    subtotal: number,
    db: DatabaseClient,
  ) {
    const now = new Date();
    const promotions = await db.promotion.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now },
        minimumSubtotal: { lte: subtotal },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const applicable = promotions.map((promotion) => {
      let discountAmount =
        promotion.discountType === CouponDiscountType.percentage
          ? subtotal * (this.toNumber(promotion.discountValue) / 100)
          : this.toNumber(promotion.discountValue);

      if (promotion.maximumDiscount !== null) {
        discountAmount = Math.min(
          discountAmount,
          this.toNumber(promotion.maximumDiscount),
        );
      }

      return {
        promotionId: promotion.id,
        promotionName: promotion.name,
        priority: promotion.priority,
        stackWithCoupons: promotion.stackWithCoupons,
        discountAmount: this.roundMoney(Math.min(subtotal, discountAmount)),
      };
    });

    return (
      applicable.sort(
        (first, second) =>
          second.priority - first.priority ||
          second.discountAmount - first.discountAmount,
      )[0] ?? { discountAmount: 0, stackWithCoupons: false }
    );
  }

  private resolveAppliedDiscounts(
    subtotal: number,
    promotion: {
      promotionId?: string;
      promotionName?: string;
      discountAmount: number;
      stackWithCoupons: boolean;
    },
    coupon: {
      couponId?: string;
      couponCode?: string;
      discountAmount: number;
    },
  ) {
    let appliedPromotion = promotion;
    let appliedCoupon = coupon;

    if (
      promotion.discountAmount > 0 &&
      coupon.discountAmount > 0 &&
      !promotion.stackWithCoupons
    ) {
      if (coupon.discountAmount > promotion.discountAmount) {
        appliedPromotion = { discountAmount: 0, stackWithCoupons: false };
      } else {
        appliedCoupon = { discountAmount: 0 };
      }
    }

    const uncappedTotal =
      appliedPromotion.discountAmount + appliedCoupon.discountAmount;
    const discountAmount = this.roundMoney(Math.min(subtotal, uncappedTotal));

    if (uncappedTotal > subtotal && appliedCoupon.discountAmount > 0) {
      appliedCoupon = {
        ...appliedCoupon,
        discountAmount: this.roundMoney(
          Math.max(0, subtotal - appliedPromotion.discountAmount),
        ),
      };
    }

    return {
      promotion: appliedPromotion,
      coupon: appliedCoupon,
      discountAmount,
    };
  }

  private getFallbackServiceFeePercent(): number {
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
      serviceFeeRule: true,
      promotion: true,
      coupon: true,
      couponRedemption: true,
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

  private formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(value);
  }
}
