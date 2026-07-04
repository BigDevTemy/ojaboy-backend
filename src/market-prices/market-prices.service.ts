import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceAlertsService } from '../price-alerts/price-alerts.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { CreateMarketPriceDto } from './dto/create-market-price.dto';
import { UpdateMarketPriceDto } from './dto/update-market-price.dto';

type MarketPriceFilters = {
  productId?: string;
  productOfferingId?: string;
  variantId?: string;
  brandId?: string;
  packageId?: string;
  marketId?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class MarketPricesService {
  private readonly logger = new Logger(MarketPricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly priceAlertsService: PriceAlertsService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async create(createMarketPriceDto: CreateMarketPriceDto) {
    if (!createMarketPriceDto.productOfferingId) {
      throw new BadRequestException(
        'productOfferingId is required for new market prices',
      );
    }
    await this.validateOfferingProduct(
      createMarketPriceDto.productOfferingId,
      createMarketPriceDto.productId,
    );
    const marketPrice = await this.prisma.marketPrice.create({
      data: await this.toMarketPriceData(createMarketPriceDto),
      include: this.relations(),
    });
    try {
      await this.priceAlertsService.evaluateMarketPrice(marketPrice);
    } catch (error) {
      this.logger.error(
        `Market price ${marketPrice.id} was saved, but price-alert evaluation failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }

    return {
      message: 'Market price created successfully.',
      marketPrice,
    };
  }

  async findAll(filters: MarketPriceFilters = {}) {
    const marketPrices = await this.prisma.marketPrice.findMany({
      where: this.toWhereInput(filters),
      include: this.relations(),
      orderBy: { observedAt: 'desc' },
    });

    return { data: marketPrices };
  }

  async findByProduct(productId: string) {
    return this.findAll({ productId });
  }

  async findByMarket(marketId: string) {
    return this.findAll({ marketId });
  }

  async findOne(id: string) {
    const marketPrice = await this.prisma.marketPrice.findUnique({
      where: { id },
      include: this.relations(),
    });

    if (!marketPrice) {
      throw new NotFoundException('Market price not found');
    }

    return { marketPrice };
  }

  async update(id: string, updateMarketPriceDto: UpdateMarketPriceDto) {
    const existing = await this.prisma.marketPrice.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Market price not found');
    }
    const productOfferingId =
      updateMarketPriceDto.productOfferingId ??
      existing.productOfferingId ??
      undefined;
    if (!productOfferingId) {
      throw new BadRequestException(
        'A productOfferingId must be assigned before updating this legacy market price',
      );
    }
    await this.validateOfferingProduct(
      productOfferingId,
      updateMarketPriceDto.productId ?? existing.productId,
    );
    try {
      const marketPrice = await this.prisma.marketPrice.update({
        where: { id },
        data: await this.toUpdateData(updateMarketPriceDto),
        include: this.relations(),
      });

      return {
        message: 'Market price updated successfully.',
        marketPrice,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market price not found');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.marketPrice.delete({
        where: { id },
      });

      return {
        message: 'Market price deleted successfully.',
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market price not found');
      }

      throw error;
    }
  }

  private async toMarketPriceData(
    dto: CreateMarketPriceDto,
  ): Promise<Prisma.MarketPriceUncheckedCreateInput> {
    const priceUnit = await this.priceUnitsService.requireByCode(dto.unit);
    return {
      productId: dto.productId,
      productOfferingId: dto.productOfferingId,
      marketId: dto.marketId,
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase(),
      priceUnitId: priceUnit.id,
      quantity: dto.quantity,
      qualityGrade: dto.qualityGrade,
      source: dto.source,
      observedAt: new Date(dto.observedAt),
      notes: dto.notes?.trim(),
    };
  }

  private async toUpdateData(
    dto: UpdateMarketPriceDto,
  ): Promise<Prisma.MarketPriceUncheckedUpdateInput> {
    const priceUnit = dto.unit
      ? await this.priceUnitsService.requireByCode(dto.unit)
      : undefined;
    return {
      productId: dto.productId,
      productOfferingId: dto.productOfferingId,
      marketId: dto.marketId,
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase(),
      priceUnitId: priceUnit?.id,
      quantity: dto.quantity,
      qualityGrade: dto.qualityGrade,
      source: dto.source,
      observedAt: dto.observedAt ? new Date(dto.observedAt) : undefined,
      notes: dto.notes?.trim(),
    };
  }

  private toWhereInput(
    filters: MarketPriceFilters,
  ): Prisma.MarketPriceWhereInput {
    return {
      productId: filters.productId,
      productOfferingId: filters.productOfferingId,
      marketId: filters.marketId,
      productOffering:
        filters.variantId || filters.brandId || filters.packageId
          ? {
              variantId: filters.variantId,
              brandId: filters.brandId,
              packageId: filters.packageId,
            }
          : undefined,
      observedAt:
        filters.from || filters.to
          ? {
              gte: filters.from ? new Date(filters.from) : undefined,
              lte: filters.to ? new Date(filters.to) : undefined,
            }
          : undefined,
    };
  }

  private relations() {
    return {
      product: true,
      market: true,
      productOffering: {
        include: {
          variant: true,
          brand: { include: { manufacturer: true } },
          package: true,
        },
      },
      priceUnit: true,
    } satisfies Prisma.MarketPriceInclude;
  }

  private async validateOfferingProduct(
    productOfferingId: string | undefined,
    productId: string,
  ) {
    if (!productOfferingId) return;
    const offering = await this.prisma.productOffering.findUnique({
      where: { id: productOfferingId },
    });
    if (!offering) {
      throw new BadRequestException('Product offering does not exist');
    }
    if (offering.productId !== productId) {
      throw new BadRequestException(
        'Product offering does not belong to the selected product',
      );
    }
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
