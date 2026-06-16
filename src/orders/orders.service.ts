import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CouponDiscountType,
  OrderFeedback,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PriceUnit,
  Prisma,
  User,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  AddressesService,
  ResolvedDeliveryAddress,
} from '../addresses/addresses.service';
import {
  AddressDetailsDto,
  AddressLocationDto,
} from '../addresses/dto/address-details.dto';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { EmailService } from '../mail/email.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderFeedbackDto } from './dto/create-order-feedback.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderPaginationQueryDto } from './dto/order-pagination-query.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { OrderQuoteNormalizerService } from './order-quote-normalizer.service';

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
  deliveryAddressId?: string;
  deliveryZoneId: string;
  deliveryAddress: {
    id?: string;
    label: string | null;
    recipientName: string | null;
    phoneNumber: string | null;
    formattedAddress: string;
    googlePlaceId: string;
    latitude: number;
    longitude: number;
    deliveryZone: {
      id: string;
      name: string;
    };
  };
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
    private readonly addressesService: AddressesService,
    private readonly paymentsService: PaymentsService,
    private readonly orderQuoteNormalizer: OrderQuoteNormalizerService,
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

  async getUserOrderStats(userId: string) {
    const [totalOrders, completedOrders, pendingOrders, moneySpent, rating] =
      await this.prisma.$transaction([
        this.prisma.order.count({ where: { userId } }),
        this.prisma.order.count({
          where: { userId, status: OrderStatus.delivered },
        }),
        this.prisma.order.count({
          where: {
            userId,
            status: {
              in: [
                OrderStatus.pending,
                OrderStatus.confirmed,
                OrderStatus.processing,
                OrderStatus.out_for_delivery,
              ],
            },
          },
        }),
        this.prisma.payment.aggregate({
          where: { userId, status: PaymentStatus.successful },
          _sum: { amount: true },
        }),
        this.prisma.orderFeedback.aggregate({
          where: { userId },
          _avg: { rating: true },
        }),
      ]);

    return {
      totalOrders,
      totalMoneySpent: moneySpent._sum.amount
        ? this.toNumber(moneySpent._sum.amount)
        : 0,
      totalCompletedOrders: completedOrders,
      totalPendingOrders: pendingOrders,
      averageRating: rating._avg.rating ?? 0,
    };
  }

  async getCurrentOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: {
          in: [
            OrderStatus.pending,
            OrderStatus.confirmed,
            OrderStatus.processing,
            OrderStatus.out_for_delivery,
          ],
        },
      },
      include: this.orderInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return { orders };
  }

  async getUserOrders(
    userId: string,
    { page = 1, limit = 50 }: OrderPaginationQueryDto,
  ) {
    const where = { userId };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: this.orderInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return { order };
  }

  async createFeedback(
    userId: string,
    orderId: string,
    dto: CreateOrderFeedbackDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.delivered) {
      throw new BadRequestException(
        'Feedback can only be submitted for a delivered order',
      );
    }

    const existingFeedback = await this.prisma.orderFeedback.findUnique({
      where: { orderId },
      select: { id: true },
    });

    if (existingFeedback) {
      throw new ConflictException('Feedback has already been submitted');
    }

    let feedback: OrderFeedback;

    try {
      feedback = await this.prisma.orderFeedback.create({
        data: {
          orderId,
          userId,
          rating: dto.rating,
          comment: dto.comment?.trim() || null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Feedback has already been submitted');
      }

      throw error;
    }

    return {
      message: 'Order feedback submitted successfully.',
      feedback,
    };
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

  async quote(dto: QuoteOrderDto, authenticatedUser?: AuthUser) {
    const customer = await this.resolveQuoteCustomer(dto, authenticatedUser);

    if (dto.orderText) {
      const normalized = await this.orderQuoteNormalizer.normalize(
        dto.orderText,
      );

      if (!normalized.canProceed) {
        return {
          message: `${normalized.summary.requiresAttention} item${normalized.summary.requiresAttention === 1 ? '' : 's'} require your attention before the quote can be completed.`,
          ...normalized,
        };
      }

      const quote = await this.calculateQuote(
        { ...dto, items: normalized.quoteItems },
        customer,
      );
      const { deliveryAddress, ...publicQuote } = quote;

      return {
        message:
          'All items were understood and the order quote was calculated successfully.',
        ...normalized,
        quote: {
          ...publicQuote,
          deliveryAddress: {
            id: deliveryAddress.id,
            label: deliveryAddress.label,
            deliveryZone: deliveryAddress.deliveryZone,
          },
        },
      };
    }

    const quote = await this.calculateQuote(dto, customer);
    const { deliveryAddress, ...publicQuote } = quote;

    return {
      message: 'Order quote calculated successfully.',
      quote: {
        ...publicQuote,
        deliveryAddress: {
          id: deliveryAddress.id,
          label: deliveryAddress.label,
          deliveryZone: deliveryAddress.deliveryZone,
        },
      },
    };
  }

  private async resolveQuoteCustomer(
    dto: QuoteOrderDto,
    authenticatedUser?: AuthUser,
  ): Promise<QuoteCustomer> {
    if (authenticatedUser) {
      return {
        id: authenticatedUser.id,
        email: authenticatedUser.email,
      };
    }

    if (!dto.customerEmail) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'CUSTOMER_EMAIL_REQUIRED_FOR_DELIVERY',
        message:
          'A JWT access token or customerEmail is required so delivery can be associated with the customer.',
      });
    }

    const customer = await this.prisma.user.findUnique({
      where: { email: dto.customerEmail.toLowerCase().trim() },
      select: { id: true, email: true },
    });

    if (!customer) {
      throw new NotFoundException({
        statusCode: 404,
        code: 'CUSTOMER_NOT_FOUND',
        message:
          'No customer account was found for this email. Create the customer account before requesting a quote.',
      });
    }

    return customer;
  }

  async create(
    dto: CreateOrderDto,
    authenticatedUser?: AuthUser,
    options?: { wishlistId?: string },
  ) {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'Order creation requires confirmed structured items',
      );
    }

    const runTransaction = () =>
      this.prisma.$transaction(
        async (tx) => {
          let user: Pick<User, 'id' | 'email'>;

          if (authenticatedUser) {
            user = {
              id: authenticatedUser.id,
              email: authenticatedUser.email,
            };
          } else {
            if (!dto.email || !dto.orderToken) {
              throw new UnauthorizedException(
                'A valid access token or order token is required',
              );
            }

            const email = dto.email.toLowerCase().trim();
            const tokenHash = this.hashToken(dto.orderToken);
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
              throw new UnauthorizedException(
                'Order token has already been used',
              );
            }

            const storedUser = await tx.user.findUnique({ where: { email } });

            if (!storedUser) {
              throw new UnauthorizedException(
                'No user account was found for this email',
              );
            }

            user = storedUser;
          }

          const storedUser = await tx.user.findUnique({
            where: { id: user.id },
            select: { id: true, email: true },
          });

          if (!storedUser) {
            throw new UnauthorizedException(
              'The authenticated user account no longer exists',
            );
          }
          user = storedUser;

          const quote = await this.calculateQuote(
            dto,
            { id: user.id, email: user.email },
            tx,
            true,
          );

          if (!quote.deliveryAddressId) {
            throw new UnprocessableEntityException({
              statusCode: 422,
              code: 'DELIVERY_ADDRESS_NOT_SAVED',
              message:
                'The delivery address could not be saved for this order.',
            });
          }

          const createdOrder = await tx.order.create({
            data: {
              userId: user.id,
              deliveryAddressId: quote.deliveryAddressId,
              deliveryZoneId: quote.deliveryZoneId,
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
              deliveryRecipientName: quote.deliveryAddress.recipientName,
              deliveryPhoneNumber: quote.deliveryAddress.phoneNumber,
              deliveryAddress: quote.deliveryAddress.formattedAddress,
              deliveryGooglePlaceId: quote.deliveryAddress.googlePlaceId,
              deliveryLatitude: quote.deliveryAddress.latitude,
              deliveryLongitude: quote.deliveryAddress.longitude,
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
                orderId: createdOrder.id,
                discountAmount: quote.couponDiscount,
              },
            });
          }

          const payment = await tx.payment.create({
            data: {
              userId: user.id,
              orderId: createdOrder.id,
              amount: quote.total,
              currency: quote.currency,
              provider: PaymentProvider.paystack,
              providerReference: `order_${createdOrder.id}`,
              status: PaymentStatus.initializing,
            },
          });

          if (options?.wishlistId) {
            const converted = await tx.wishlist.updateMany({
              where: {
                id: options.wishlistId,
                userId: user.id,
                convertedAt: null,
                orderId: null,
              },
              data: {
                convertedAt: new Date(),
                orderId: createdOrder.id,
              },
            });

            if (converted.count !== 1) {
              throw new ConflictException(
                'The wishlist was already converted or is unavailable',
              );
            }
          }

          const order = await tx.order.findUniqueOrThrow({
            where: { id: createdOrder.id },
            include: this.orderInclude(),
          });

          return { order, payment, quote };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10_000,
          timeout: 30_000,
        },
      );

    let transactionResult: Awaited<ReturnType<typeof runTransaction>>;

    try {
      transactionResult = await runTransaction();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      const prismaCode =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? error.code
          : undefined;

      if (prismaCode === 'P2028') {
        throw new ServiceUnavailableException({
          statusCode: 503,
          code: 'ORDER_TRANSACTION_TIMEOUT',
          message:
            'Order creation took too long to complete. No order or address was saved. Please retry.',
        });
      }

      if (prismaCode === 'P2034') {
        throw new ConflictException({
          statusCode: 409,
          code: 'ORDER_TRANSACTION_CONFLICT',
          message:
            'The order could not be completed because pricing or checkout data changed. Please retry.',
        });
      }

      this.logger.error(
        'Order creation transaction failed',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }

    const { order, payment, quote } = transactionResult;

    const paymentInitialization =
      await this.paymentsService.initializePaymentAttempt(payment.id);

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

    const responseOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: this.orderInclude(),
    });

    return {
      message: 'Order created successfully.',
      order: responseOrder,
      payment: paymentInitialization,
    };
  }

  retryPayment(orderId: string, email: string) {
    return this.paymentsService.retryOrderPayment(orderId, email);
  }

  private async calculateQuote(
    dto: QuoteOrderDto,
    customer?: QuoteCustomer,
    db: DatabaseClient = this.prisma,
    persistSuppliedAddress = false,
  ): Promise<OrderQuote> {
    if (!customer) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'CUSTOMER_REQUIRED_FOR_DELIVERY',
        message: 'A customer account is required to calculate delivery.',
      });
    }

    const deliveryAddress: ResolvedDeliveryAddress = dto.deliveryAddress
      ? persistSuppliedAddress
        ? await this.addressesService.getOrCreateOrderAddress(
            customer.id,
            this.requireCompleteOrderAddress(dto.deliveryAddress),
            db,
          )
        : await this.addressesService.resolveOrderAddress(
            dto.deliveryAddress,
            db,
          )
      : await this.addressesService.getValidatedDefaultAddress(customer.id, db);
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
      deliveryAddress.deliveryZoneId,
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
      deliveryAddressId: deliveryAddress.id,
      deliveryZoneId: deliveryAddress.deliveryZoneId,
      deliveryAddress: {
        id: deliveryAddress.id,
        label: deliveryAddress.label,
        recipientName: deliveryAddress.recipientName,
        phoneNumber: deliveryAddress.phoneNumber,
        formattedAddress: deliveryAddress.formattedAddress,
        googlePlaceId: deliveryAddress.googlePlaceId,
        latitude: this.toNumber(deliveryAddress.latitude),
        longitude: this.toNumber(deliveryAddress.longitude),
        deliveryZone: {
          id: deliveryAddress.deliveryZone.id,
          name: deliveryAddress.deliveryZone.name,
        },
      },
    };
  }

  private async calculateDeliveryFee(
    deliveryZoneId: string,
    db: DatabaseClient = this.prisma,
  ): Promise<number> {
    const deliveryZone = await db.deliveryZone.findUnique({
      where: { id: deliveryZoneId },
    });

    if (!deliveryZone?.isActive) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'DELIVERY_ZONE_UNAVAILABLE',
        message: 'Delivery is not available for the selected address zone.',
        deliveryZoneId,
      });
    }

    const deliveryFee = this.roundMoney(
      this.toNumber(deliveryZone.deliveryCost),
    );

    if (deliveryFee <= 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'DELIVERY_ZONE_COST_MISSING',
        message:
          'A positive delivery cost has not been configured for this delivery zone.',
        deliveryZoneId,
      });
    }

    return deliveryFee;
  }

  private requireCompleteOrderAddress(
    address: AddressLocationDto,
  ): AddressDetailsDto {
    const candidate = address as AddressDetailsDto;

    if (!candidate.recipientName?.trim() || !candidate.phoneNumber?.trim()) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'DELIVERY_CONTACT_REQUIRED',
        message:
          'recipientName and phoneNumber are required before the delivery address can be saved with an order.',
      });
    }

    return candidate;
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
      feedback: true,
      address: true,
      deliveryZone: true,
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
