import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketPrice,
  NotificationPriority,
  NotificationSource,
  PriceAlertCondition,
  PriceAlertFrequency,
  PriceAlertStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { PriceAlertQueryDto } from './dto/price-alert-query.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';

@Injectable()
export class PriceAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async create(userId: string, dto: CreatePriceAlertDto) {
    await this.validateOffering(dto.productId, dto.productOfferingId);
    await this.ensureNoActiveDuplicate(userId, {
      productOfferingId: dto.productOfferingId,
      condition: dto.condition,
      targetPrice: dto.targetPrice,
    });
    const priceUnit = await this.priceUnitsService.requireByCode(dto.unit);

    const priceAlert = await this.prisma.priceAlert.create({
      data: {
        userId,
        productId: dto.productId,
        productOfferingId: dto.productOfferingId,
        targetPrice: dto.targetPrice,
        currency: dto.currency?.trim() || 'NGN',
        priceUnitId: priceUnit.id,
        condition: dto.condition,
        frequency: dto.frequency,
      },
      include: this.priceAlertInclude(),
    });

    return {
      message: 'Price alert created successfully.',
      priceAlert,
    };
  }

  async findAll(userId: string, query: PriceAlertQueryDto = {}) {
    const priceAlerts = await this.prisma.priceAlert.findMany({
      where: {
        userId,
        productId: query.productId,
        productOfferingId: query.productOfferingId,
        status: query.status,
      },
      include: this.priceAlertInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: priceAlerts };
  }

  async findOne(userId: string, id: string) {
    const priceAlert = await this.getOwnedPriceAlert(userId, id);
    return { priceAlert };
  }

  async update(userId: string, id: string, dto: UpdatePriceAlertDto) {
    const existing = await this.getOwnedPriceAlert(userId, id);

    const next = {
      productId: dto.productId ?? existing.productId,
      productOfferingId: dto.productOfferingId ?? existing.productOfferingId,
      condition: dto.condition ?? existing.condition,
      targetPrice: dto.targetPrice ?? this.toNumber(existing.targetPrice),
    };
    await this.validateOffering(next.productId, next.productOfferingId);

    if ((dto.status ?? existing.status) === PriceAlertStatus.active) {
      await this.ensureNoActiveDuplicate(userId, next, existing.id);
    }

    const priceUnit = dto.unit
      ? await this.priceUnitsService.requireByCode(dto.unit)
      : undefined;

    const priceAlert = await this.prisma.priceAlert.update({
      where: { id: existing.id },
      data: {
        productId: dto.productId,
        productOfferingId: dto.productOfferingId,
        targetPrice: dto.targetPrice,
        currency: dto.currency?.trim(),
        priceUnitId: priceUnit?.id,
        condition: dto.condition,
        frequency: dto.frequency,
        status: dto.status,
      },
      include: this.priceAlertInclude(),
    });

    return {
      message: 'Price alert updated successfully.',
      priceAlert,
    };
  }

  async remove(userId: string, id: string) {
    const priceAlert = await this.getOwnedPriceAlert(userId, id);

    await this.prisma.priceAlert.delete({
      where: { id: priceAlert.id },
    });

    return {
      message: 'Price alert deleted successfully.',
      deletedPriceAlertId: priceAlert.id,
    };
  }

  async evaluateMarketPrice(marketPrice: MarketPrice) {
    if (!marketPrice.productOfferingId) {
      return { evaluated: 0, triggered: 0 };
    }
    // A price of 0 means "not yet known" (e.g. catalogued before a real
    // observation exists) and must never trigger an at-or-below alert.
    if (this.toNumber(marketPrice.amount) <= 0) {
      return { evaluated: 0, triggered: 0 };
    }

    const alerts = await this.prisma.priceAlert.findMany({
      where: {
        productOfferingId: marketPrice.productOfferingId,
        currency: marketPrice.currency,
        status: PriceAlertStatus.active,
      },
      include: this.priceAlertInclude(),
    });
    let triggered = 0;

    for (const alert of alerts) {
      const currentPrice = this.toNumber(marketPrice.amount);
      const targetPrice = this.toNumber(alert.targetPrice);
      if (
        !this.conditionMatches(alert.condition, currentPrice, targetPrice) ||
        !this.frequencyAllows(
          alert.frequency,
          alert.lastTriggeredAt,
          marketPrice.observedAt,
        )
      ) {
        continue;
      }

      const nextStatus =
        alert.frequency === PriceAlertFrequency.one_time
          ? PriceAlertStatus.triggered
          : PriceAlertStatus.active;
      const updated = await this.prisma.priceAlert.updateMany({
        where: {
          id: alert.id,
          status: PriceAlertStatus.active,
          lastTriggeredAt: alert.lastTriggeredAt,
        },
        data: {
          lastTriggeredAt: marketPrice.observedAt,
          triggeredPrice: marketPrice.amount,
          triggerCount: { increment: 1 },
          status: nextStatus,
        },
      });
      if (updated.count !== 1) continue;

      await this.prisma.notification.create({
        data: {
          userId: alert.userId,
          title: `Price alert: ${this.offeringLabel(alert)}`,
          body: `${this.offeringLabel(alert)} is now ${marketPrice.currency} ${currentPrice.toLocaleString()}.`,
          source: NotificationSource.price_alert,
          event: 'price_alert_triggered',
          priority: NotificationPriority.high,
          priceAlertId: alert.id,
          metadata: {
            productId: alert.productId,
            productOfferingId: alert.productOfferingId,
            marketPriceId: marketPrice.id,
            targetPrice,
            triggeredPrice: currentPrice,
            condition: alert.condition,
          },
        },
      });
      triggered += 1;
    }

    return { evaluated: alerts.length, triggered };
  }

  private async getOwnedPriceAlert(userId: string, id: string) {
    const priceAlert = await this.prisma.priceAlert.findFirst({
      where: { id, userId },
      include: this.priceAlertInclude(),
    });

    if (!priceAlert) {
      throw new NotFoundException('Price alert not found');
    }

    return priceAlert;
  }

  private async validateOffering(productId: string, productOfferingId: string) {
    const offering = await this.prisma.productOffering.findUnique({
      where: { id: productOfferingId },
      select: { id: true, productId: true, isActive: true },
    });

    if (!offering) {
      throw new NotFoundException('Product offering not found');
    }
    if (offering.productId !== productId) {
      throw new BadRequestException(
        'Product offering does not belong to the selected product',
      );
    }
    if (!offering.isActive) {
      throw new BadRequestException('Product offering is not active');
    }
  }

  private async ensureNoActiveDuplicate(
    userId: string,
    input: {
      productOfferingId: string;
      condition?: PriceAlertCondition;
      targetPrice: number;
    },
    excludeId?: string,
  ) {
    const condition = input.condition ?? PriceAlertCondition.at_or_below;
    const duplicate = await this.prisma.priceAlert.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        userId,
        productOfferingId: input.productOfferingId,
        condition,
        targetPrice: new Prisma.Decimal(input.targetPrice),
        status: PriceAlertStatus.active,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'An active price alert already exists for this product offering, condition, and target price',
      );
    }
  }

  private priceAlertInclude() {
    return {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          category: true,
          imageUrl: true,
          status: true,
        },
      },
      productOffering: {
        include: {
          variant: true,
          brand: { include: { manufacturer: true } },
          package: true,
        },
      },
      priceUnit: true,
    } satisfies Prisma.PriceAlertInclude;
  }

  private conditionMatches(
    condition: PriceAlertCondition,
    currentPrice: number,
    targetPrice: number,
  ) {
    switch (condition) {
      case PriceAlertCondition.below:
        return currentPrice < targetPrice;
      case PriceAlertCondition.above:
        return currentPrice > targetPrice;
      case PriceAlertCondition.at_or_below:
        return currentPrice <= targetPrice;
      case PriceAlertCondition.at_or_above:
        return currentPrice >= targetPrice;
    }
  }

  private frequencyAllows(
    frequency: PriceAlertFrequency,
    lastTriggeredAt: Date | null,
    observedAt: Date,
  ) {
    if (!lastTriggeredAt) {
      return true;
    }
    const elapsed = observedAt.getTime() - lastTriggeredAt.getTime();
    if (frequency === PriceAlertFrequency.every_price_change) {
      return elapsed > 0;
    }
    if (frequency === PriceAlertFrequency.once_per_day) {
      return elapsed >= 24 * 60 * 60 * 1000;
    }
    if (frequency === PriceAlertFrequency.once_per_week) {
      return elapsed >= 7 * 24 * 60 * 60 * 1000;
    }
    return false;
  }

  private offeringLabel(alert: {
    product: { name: string };
    productOffering: {
      variant: { name: string } | null;
      brand: { name: string } | null;
      package: { name: string };
    };
  }) {
    return [
      alert.productOffering.brand?.name,
      alert.productOffering.variant?.name,
      alert.product.name,
      alert.productOffering.package.name,
    ]
      .filter(Boolean)
      .join(' — ');
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
