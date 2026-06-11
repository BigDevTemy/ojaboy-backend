import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponDiscountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateServiceFeeRuleDto } from './dto/create-service-fee-rule.dto';

@Injectable()
export class CommerceConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async createServiceFeeRule(dto: CreateServiceFeeRuleDto) {
    this.validateFeeBounds(dto.minimumFee, dto.maximumFee);
    this.validateDates(dto.validFrom, dto.validUntil);
    const isActive = dto.isActive ?? true;
    const rule = await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.serviceFeeRule.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      return tx.serviceFeeRule.create({
        data: {
          name: dto.name.trim(),
          percentage: dto.percentage,
          baseFee: dto.baseFee,
          minimumFee: dto.minimumFee,
          maximumFee: dto.maximumFee,
          currency: dto.currency?.trim().toUpperCase(),
          isActive,
          validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        },
      });
    });

    return { message: 'Service fee rule created successfully.', rule };
  }

  async findServiceFeeRules() {
    const rules = await this.prisma.serviceFeeRule.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return { data: rules };
  }

  async activateServiceFeeRule(id: string) {
    const rule = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceFeeRule.findUnique({ where: { id } });

      if (!existing) {
        throw new NotFoundException('Service fee rule not found');
      }

      await tx.serviceFeeRule.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      });

      return tx.serviceFeeRule.update({
        where: { id },
        data: { isActive: true },
      });
    });

    return { message: 'Service fee rule activated successfully.', rule };
  }

  async createCoupon(dto: CreateCouponDto) {
    this.validateDates(dto.validFrom, dto.validUntil);
    if (
      dto.discountType === CouponDiscountType.percentage &&
      dto.discountValue > 100
    ) {
      throw new BadRequestException(
        'Percentage discount cannot be greater than 100',
      );
    }

    const userIds = [...new Set(dto.eligibleUserIds ?? [])];
    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        description: dto.description?.trim(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maximumDiscount: dto.maximumDiscount,
        minimumSubtotal: dto.minimumSubtotal,
        usageLimit: dto.usageLimit,
        perCustomerLimit: dto.perCustomerLimit,
        isActive: dto.isActive,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        eligibleCustomers: userIds.length
          ? { create: userIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: { eligibleCustomers: true },
    });

    return { message: 'Coupon created successfully.', coupon };
  }

  async findCoupons() {
    const coupons = await this.prisma.coupon.findMany({
      include: {
        eligibleCustomers: {
          include: {
            user: { select: { id: true, email: true, fullName: true } },
          },
        },
        _count: { select: { redemptions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: coupons };
  }

  async toggleCoupon(id: string) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Coupon not found');
    }

    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return { message: 'Coupon status updated successfully.', coupon };
  }

  async createPromotion(dto: CreatePromotionDto) {
    this.validateDates(dto.validFrom, dto.validUntil);
    this.validatePercentageDiscount(dto.discountType, dto.discountValue);

    const promotion = await this.prisma.promotion.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maximumDiscount: dto.maximumDiscount,
        minimumSubtotal: dto.minimumSubtotal,
        priority: dto.priority,
        stackWithCoupons: dto.stackWithCoupons,
        isActive: dto.isActive,
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
      },
    });

    return { message: 'Promotion created successfully.', promotion };
  }

  async findPromotions() {
    const promotions = await this.prisma.promotion.findMany({
      orderBy: [{ priority: 'desc' }, { validFrom: 'desc' }],
    });

    return { data: promotions };
  }

  async togglePromotion(id: string) {
    const existing = await this.prisma.promotion.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    const promotion = await this.prisma.promotion.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return { message: 'Promotion status updated successfully.', promotion };
  }

  private validateFeeBounds(minimumFee?: number, maximumFee?: number) {
    if (
      minimumFee !== undefined &&
      maximumFee !== undefined &&
      minimumFee > maximumFee
    ) {
      throw new BadRequestException(
        'minimumFee cannot be greater than maximumFee',
      );
    }
  }

  private validateDates(validFrom?: string, validUntil?: string) {
    if (
      validFrom &&
      validUntil &&
      new Date(validFrom).getTime() >= new Date(validUntil).getTime()
    ) {
      throw new BadRequestException('validUntil must be after validFrom');
    }
  }

  private validatePercentageDiscount(
    discountType: CouponDiscountType,
    discountValue: number,
  ) {
    if (discountType === CouponDiscountType.percentage && discountValue > 100) {
      throw new BadRequestException(
        'Percentage discount cannot be greater than 100',
      );
    }
  }
}
