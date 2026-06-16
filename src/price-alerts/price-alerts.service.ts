import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PriceAlertCondition,
  PriceAlertStatus,
  PriceUnit,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { PriceAlertQueryDto } from './dto/price-alert-query.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';

@Injectable()
export class PriceAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePriceAlertDto) {
    await this.ensureProductExists(dto.productId);
    await this.ensureNoActiveDuplicate(userId, {
      productId: dto.productId,
      unit: dto.unit,
      condition: dto.condition,
      targetPrice: dto.targetPrice,
    });

    const priceAlert = await this.prisma.priceAlert.create({
      data: {
        userId,
        productId: dto.productId,
        targetPrice: dto.targetPrice,
        currency: dto.currency?.trim() || 'NGN',
        unit: dto.unit,
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

    if (dto.productId) {
      await this.ensureProductExists(dto.productId);
    }

    const next = {
      productId: dto.productId ?? existing.productId,
      unit: dto.unit ?? existing.unit,
      condition: dto.condition ?? existing.condition,
      targetPrice: dto.targetPrice ?? this.toNumber(existing.targetPrice),
    };

    if ((dto.status ?? existing.status) === PriceAlertStatus.active) {
      await this.ensureNoActiveDuplicate(userId, next, existing.id);
    }

    const priceAlert = await this.prisma.priceAlert.update({
      where: { id: existing.id },
      data: {
        productId: dto.productId,
        targetPrice: dto.targetPrice,
        currency: dto.currency?.trim(),
        unit: dto.unit,
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

  private async ensureProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
  }

  private async ensureNoActiveDuplicate(
    userId: string,
    input: {
      productId: string;
      unit: PriceUnit;
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
        productId: input.productId,
        unit: input.unit,
        condition,
        targetPrice: new Prisma.Decimal(input.targetPrice),
        status: PriceAlertStatus.active,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(
        'An active price alert already exists for this product, unit, condition, and target price',
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
    } satisfies Prisma.PriceAlertInclude;
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
