import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketPriceDto } from './dto/create-market-price.dto';
import { UpdateMarketPriceDto } from './dto/update-market-price.dto';

type MarketPriceFilters = {
  productId?: string;
  marketId?: string;
  from?: string;
  to?: string;
};

@Injectable()
export class MarketPricesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMarketPriceDto: CreateMarketPriceDto) {
    const marketPrice = await this.prisma.marketPrice.create({
      data: this.toMarketPriceData(createMarketPriceDto),
      include: { product: true, market: true },
    });

    return {
      message: 'Market price created successfully.',
      marketPrice,
    };
  }

  async findAll(filters: MarketPriceFilters = {}) {
    const marketPrices = await this.prisma.marketPrice.findMany({
      where: this.toWhereInput(filters),
      include: { product: true, market: true },
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
      include: { product: true, market: true },
    });

    if (!marketPrice) {
      throw new NotFoundException('Market price not found');
    }

    return { marketPrice };
  }

  async update(id: string, updateMarketPriceDto: UpdateMarketPriceDto) {
    try {
      const marketPrice = await this.prisma.marketPrice.update({
        where: { id },
        data: this.toUpdateData(updateMarketPriceDto),
        include: { product: true, market: true },
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

  private toMarketPriceData(
    dto: CreateMarketPriceDto,
  ): Prisma.MarketPriceUncheckedCreateInput {
    return {
      productId: dto.productId,
      marketId: dto.marketId,
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase(),
      unit: dto.unit,
      quantity: dto.quantity,
      qualityGrade: dto.qualityGrade,
      source: dto.source,
      observedAt: new Date(dto.observedAt),
      notes: dto.notes?.trim(),
    };
  }

  private toUpdateData(
    dto: UpdateMarketPriceDto,
  ): Prisma.MarketPriceUncheckedUpdateInput {
    return {
      productId: dto.productId,
      marketId: dto.marketId,
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase(),
      unit: dto.unit,
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
      marketId: filters.marketId,
      observedAt:
        filters.from || filters.to
          ? {
              gte: filters.from ? new Date(filters.from) : undefined,
              lte: filters.to ? new Date(filters.to) : undefined,
            }
          : undefined,
    };
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
