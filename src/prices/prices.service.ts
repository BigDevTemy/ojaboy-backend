import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BuyPriceStrategy,
  MarketPrice,
  PriceQualityGrade,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BulkCalculateBuyPricesDto } from './dto/bulk-calculate-buy-prices.dto';
import { CalculateBuyPriceDto } from './dto/calculate-buy-price.dto';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';

type MarketPriceWithRelations = MarketPrice & {
  market: { id: string; marketname: string; marketaddress: string | null };
  product: { id: string; name: string; sku: string };
};

type StrategyResult = {
  strategyUsed: BuyPriceStrategy;
  productId: string;
  marketId?: string;
  marketPriceId?: string;
  baseMarketPrice: number;
  marginAmount: number;
  logisticsBuffer: number;
  riskBuffer: number;
  finalPrice: number;
  currency: string;
  unit: CalculateBuyPriceDto['unit'];
  landedCost?: number;
  selectedMarketPrice?: MarketPriceWithRelations;
  consideredMarketPrices: MarketPriceWithRelations[];
  explanation: string;
};

@Injectable()
export class PricesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPriceDto: CreatePriceDto) {
    const price = await this.prisma.$transaction(async (tx) => {
      if (createPriceDto.isActive ?? true) {
        await tx.buyPrice.updateMany({
          where: { productId: createPriceDto.productId, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.buyPrice.create({
        data: this.toPriceData(createPriceDto),
        include: { product: true, market: true, marketPrice: true },
      });
    });

    return {
      message: 'Buy price created successfully.',
      price,
    };
  }

  async calculate(calculateBuyPriceDto: CalculateBuyPriceDto) {
    const result = await this.calculateStrategy(calculateBuyPriceDto);

    return {
      message: 'Buy price calculated successfully.',
      result,
    };
  }

  async generate(calculateBuyPriceDto: CalculateBuyPriceDto) {
    const result = await this.calculateStrategy(calculateBuyPriceDto);

    const price = await this.prisma.$transaction(async (tx) => {
      if (calculateBuyPriceDto.isActive ?? true) {
        await tx.buyPrice.updateMany({
          where: { productId: result.productId, isActive: true },
          data: { isActive: false },
        });
      }

      return tx.buyPrice.create({
        data: {
          productId: result.productId,
          marketId: result.marketId,
          marketPriceId: result.marketPriceId,
          baseMarketPrice: result.baseMarketPrice,
          marginAmount: result.marginAmount,
          logisticsBuffer: result.logisticsBuffer,
          riskBuffer: result.riskBuffer,
          finalPrice: result.finalPrice,
          currency: result.currency,
          unit: result.unit,
          strategyUsed: result.strategyUsed,
          isActive: calculateBuyPriceDto.isActive,
          validFrom: calculateBuyPriceDto.validFrom
            ? new Date(calculateBuyPriceDto.validFrom)
            : undefined,
          validUntil: calculateBuyPriceDto.validUntil
            ? new Date(calculateBuyPriceDto.validUntil)
            : undefined,
        },
        include: { product: true, market: true, marketPrice: true },
      });
    });

    return {
      message: 'Buy price generated successfully.',
      strategy: result,
      price,
    };
  }

  async calculateBulk(bulkCalculateBuyPricesDto: BulkCalculateBuyPricesDto) {
    const targets = await this.findBulkTargets(bulkCalculateBuyPricesDto);
    const results = await this.calculateBulkTargets(
      bulkCalculateBuyPricesDto,
      targets,
    );

    return {
      message: 'Bulk buy prices calculated successfully.',
      count: results.length,
      results,
    };
  }

  async generateBulk(bulkCalculateBuyPricesDto: BulkCalculateBuyPricesDto) {
    const targets = await this.findBulkTargets(bulkCalculateBuyPricesDto);
    const results = await this.calculateBulkTargets(
      bulkCalculateBuyPricesDto,
      targets,
    );

    const prices = await this.prisma.$transaction(async (tx) => {
      const createdPrices: Awaited<
        ReturnType<typeof tx.buyPrice.create>
      >[] = [];

      for (const result of results) {
        if (bulkCalculateBuyPricesDto.isActive ?? true) {
          await tx.buyPrice.updateMany({
            where: { productId: result.productId, isActive: true },
            data: { isActive: false },
          });
        }

        const price = await tx.buyPrice.create({
          data: {
            productId: result.productId,
            marketId: result.marketId,
            marketPriceId: result.marketPriceId,
            baseMarketPrice: result.baseMarketPrice,
            marginAmount: result.marginAmount,
            logisticsBuffer: result.logisticsBuffer,
            riskBuffer: result.riskBuffer,
            finalPrice: result.finalPrice,
            currency: result.currency,
            unit: result.unit,
            strategyUsed: result.strategyUsed,
            isActive: bulkCalculateBuyPricesDto.isActive,
            validFrom: bulkCalculateBuyPricesDto.validFrom
              ? new Date(bulkCalculateBuyPricesDto.validFrom)
              : undefined,
            validUntil: bulkCalculateBuyPricesDto.validUntil
              ? new Date(bulkCalculateBuyPricesDto.validUntil)
              : undefined,
          },
          include: { product: true, market: true, marketPrice: true },
        });

        createdPrices.push(price);
      }

      return createdPrices;
    });

    return {
      message: 'Bulk buy prices generated successfully.',
      count: prices.length,
      prices,
    };
  }

  async findAll() {
    const prices = await this.prisma.buyPrice.findMany({
      include: { product: true, market: true, marketPrice: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: prices };
  }

  async findByProduct(productId: string) {
    const prices = await this.prisma.buyPrice.findMany({
      where: { productId },
      include: { product: true, market: true, marketPrice: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: prices };
  }

  async findByMarket(marketId: string) {
    const prices = await this.prisma.buyPrice.findMany({
      where: { marketId },
      include: { product: true, market: true, marketPrice: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: prices };
  }

  async findActiveByProduct(productId: string) {
    const price = await this.prisma.buyPrice.findFirst({
      where: { productId, isActive: true },
      include: { product: true, market: true, marketPrice: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!price) {
      throw new NotFoundException('Active buy price not found');
    }

    return { price };
  }

  async findOne(id: string) {
    const price = await this.prisma.buyPrice.findUnique({
      where: { id },
      include: { product: true, market: true, marketPrice: true },
    });

    if (!price) {
      throw new NotFoundException('Buy price not found');
    }

    return { price };
  }

  async update(id: string, updatePriceDto: UpdatePriceDto) {
    try {
      const existingPrice = await this.prisma.buyPrice.findUniqueOrThrow({
        where: { id },
      });

      const price = await this.prisma.$transaction(async (tx) => {
        if (updatePriceDto.isActive) {
          await tx.buyPrice.updateMany({
            where: {
              productId: existingPrice.productId,
              isActive: true,
              id: { not: id },
            },
            data: { isActive: false },
          });
        }

        return tx.buyPrice.update({
          where: { id },
          data: this.toUpdateData(updatePriceDto),
          include: { product: true, market: true, marketPrice: true },
        });
      });

      return {
        message: 'Buy price updated successfully.',
        price,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Buy price not found');
      }

      throw error;
    }
  }

  async activate(id: string) {
    const existingPrice = await this.prisma.buyPrice.findUnique({
      where: { id },
    });

    if (!existingPrice) {
      throw new NotFoundException('Buy price not found');
    }

    const price = await this.prisma.$transaction(async (tx) => {
      await tx.buyPrice.updateMany({
        where: {
          productId: existingPrice.productId,
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });

      return tx.buyPrice.update({
        where: { id },
        data: { isActive: true },
        include: { product: true, market: true, marketPrice: true },
      });
    });

    return {
      message: 'Buy price activated successfully.',
      price,
    };
  }

  async remove(id: string) {
    try {
      await this.prisma.buyPrice.delete({
        where: { id },
      });

      return {
        message: 'Buy price deleted successfully.',
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Buy price not found');
      }

      throw error;
    }
  }

  private toPriceData(dto: CreatePriceDto): Prisma.BuyPriceUncheckedCreateInput {
    const finalPrice =
      dto.finalPrice ??
      dto.baseMarketPrice +
        (dto.marginAmount ?? 0) +
        (dto.logisticsBuffer ?? 0) +
        (dto.riskBuffer ?? 0);

    return {
      productId: dto.productId,
      marketId: dto.marketId,
      marketPriceId: dto.marketPriceId,
      baseMarketPrice: dto.baseMarketPrice,
      marginAmount: dto.marginAmount,
      logisticsBuffer: dto.logisticsBuffer,
      riskBuffer: dto.riskBuffer,
      finalPrice,
      currency: dto.currency?.trim().toUpperCase(),
      unit: dto.unit,
      strategyUsed: dto.strategyUsed,
      isActive: dto.isActive,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
  }

  private toUpdateData(dto: UpdatePriceDto): Prisma.BuyPriceUncheckedUpdateInput {
    return {
      marketId: dto.marketId,
      marketPriceId: dto.marketPriceId,
      baseMarketPrice: dto.baseMarketPrice,
      marginAmount: dto.marginAmount,
      logisticsBuffer: dto.logisticsBuffer,
      riskBuffer: dto.riskBuffer,
      finalPrice: dto.finalPrice,
      currency: dto.currency?.trim().toUpperCase(),
      unit: dto.unit,
      strategyUsed: dto.strategyUsed,
      isActive: dto.isActive,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private async calculateStrategy(
    dto: CalculateBuyPriceDto,
  ): Promise<StrategyResult> {
    if (dto.strategy === BuyPriceStrategy.manual_override) {
      return this.calculateManualOverride(dto);
    }

    const marketPrices = await this.findMarketPricesForStrategy(dto);

    if (marketPrices.length === 0) {
      throw new NotFoundException('No market prices found for this strategy');
    }

    switch (dto.strategy) {
      case BuyPriceStrategy.cheapest:
        return this.fromSelectedMarketPrice(
          dto,
          this.findCheapest(marketPrices),
          marketPrices,
          'Selected the lowest observed market price.',
        );
      case BuyPriceStrategy.average:
        return this.fromAggregatePrice(
          dto,
          this.average(marketPrices),
          marketPrices,
          'Used the average of matching market prices.',
        );
      case BuyPriceStrategy.median:
        return this.fromAggregatePrice(
          dto,
          this.median(marketPrices),
          marketPrices,
          'Used the median of matching market prices.',
        );
      case BuyPriceStrategy.preferred_market:
        return this.fromSelectedMarketPrice(
          dto,
          this.findPreferredMarketPrice(dto, marketPrices),
          marketPrices,
          'Selected the latest price from the configured preferred market.',
        );
      case BuyPriceStrategy.single_market:
        return this.fromSelectedMarketPrice(
          dto,
          this.findSingleMarketPrice(dto, marketPrices),
          marketPrices,
          'Selected the latest price from one configured market.',
        );
      case BuyPriceStrategy.quality_first:
        return this.fromSelectedMarketPrice(
          dto,
          this.findQualityFirst(marketPrices),
          marketPrices,
          'Selected the best available quality grade, then lowest price.',
        );
      case BuyPriceStrategy.fastest_fulfillment:
        return this.fromSelectedMarketPrice(
          dto,
          this.findFastestFulfillment(dto, marketPrices),
          marketPrices,
          'Selected the first available market from the fulfillment priority list.',
        );
      case BuyPriceStrategy.hybrid_landed_cost:
        return this.calculateHybridLandedCost(dto, marketPrices);
      default:
        throw new BadRequestException('Unsupported buy price strategy');
    }
  }

  private async findBulkTargets(dto: BulkCalculateBuyPricesDto) {
    const marketPrices = await this.prisma.marketPrice.findMany({
      where: {
        productId: dto.productIds?.length ? { in: dto.productIds } : undefined,
        unit: dto.unit,
        product: dto.category ? { category: dto.category } : undefined,
        observedAt:
          dto.observedFrom || dto.observedTo
            ? {
                gte: dto.observedFrom ? this.toStartDate(dto.observedFrom) : undefined,
                lte: dto.observedTo ? this.toEndDate(dto.observedTo) : undefined,
              }
            : undefined,
      },
      distinct: ['productId', 'unit'],
      select: { productId: true, unit: true },
      orderBy: { observedAt: 'desc' },
    });

    if (marketPrices.length === 0) {
      throw new NotFoundException('No products found for bulk buy price calculation');
    }

    return marketPrices;
  }

  private async calculateBulkTargets(
    dto: BulkCalculateBuyPricesDto,
    targets: Array<Pick<MarketPrice, 'productId' | 'unit'>>,
  ) {
    const results: StrategyResult[] = [];

    for (const target of targets) {
      const result = await this.calculateStrategy({
        productId: target.productId,
        unit: target.unit,
        strategy: dto.strategy,
        preferredMarketId: dto.preferredMarketId,
        marketId: dto.marketId,
        deliveryZoneId: dto.deliveryZoneId,
        marketPriorityIds: dto.marketPriorityIds,
        marketLogisticsCosts: dto.marketLogisticsCosts,
        observedFrom: dto.observedFrom,
        observedTo: dto.observedTo,
        marginAmount: dto.marginAmount,
        logisticsBuffer: dto.logisticsBuffer,
        riskBuffer: dto.riskBuffer,
        currency: dto.currency,
        isActive: dto.isActive,
        validFrom: dto.validFrom,
        validUntil: dto.validUntil,
      });

      results.push(result);
    }

    return results;
  }

  private async findMarketPricesForStrategy(
    dto: CalculateBuyPriceDto,
  ): Promise<MarketPriceWithRelations[]> {
    return this.prisma.marketPrice.findMany({
      where: {
        productId: dto.productId,
        unit: dto.unit,
        observedAt:
          dto.observedFrom || dto.observedTo
            ? {
                gte: dto.observedFrom ? this.toStartDate(dto.observedFrom) : undefined,
                lte: dto.observedTo ? this.toEndDate(dto.observedTo) : undefined,
              }
            : undefined,
      },
      include: { product: true, market: true },
      orderBy: { observedAt: 'desc' },
    });
  }

  private calculateManualOverride(dto: CalculateBuyPriceDto): StrategyResult {
    if (dto.manualFinalPrice === undefined && dto.manualBaseMarketPrice === undefined) {
      throw new BadRequestException(
        'manualFinalPrice or manualBaseMarketPrice is required for manual override',
      );
    }

    const baseMarketPrice = dto.manualBaseMarketPrice ?? dto.manualFinalPrice ?? 0;

    return this.buildResult({
      dto,
      baseMarketPrice,
      selectedMarketPrice: undefined,
      consideredMarketPrices: [],
      explanation: 'Used a manually supplied buy price.',
      finalPrice: dto.manualFinalPrice,
    });
  }

  private fromSelectedMarketPrice(
    dto: CalculateBuyPriceDto,
    selectedMarketPrice: MarketPriceWithRelations,
    consideredMarketPrices: MarketPriceWithRelations[],
    explanation: string,
  ): StrategyResult {
    return this.buildResult({
      dto,
      selectedMarketPrice,
      consideredMarketPrices,
      baseMarketPrice: this.toNumber(selectedMarketPrice.amount),
      explanation,
    });
  }

  private fromAggregatePrice(
    dto: CalculateBuyPriceDto,
    baseMarketPrice: number,
    consideredMarketPrices: MarketPriceWithRelations[],
    explanation: string,
  ): StrategyResult {
    return this.buildResult({
      dto,
      baseMarketPrice,
      consideredMarketPrices,
      explanation,
    });
  }

  private buildResult(input: {
    dto: CalculateBuyPriceDto;
    baseMarketPrice: number;
    consideredMarketPrices: MarketPriceWithRelations[];
    explanation: string;
    selectedMarketPrice?: MarketPriceWithRelations;
    logisticsBuffer?: number;
    landedCost?: number;
    finalPrice?: number;
  }): StrategyResult {
    const marginAmount = input.dto.marginAmount ?? 0;
    const logisticsBuffer = input.logisticsBuffer ?? input.dto.logisticsBuffer ?? 0;
    const riskBuffer = input.dto.riskBuffer ?? 0;
    const finalPrice =
      input.finalPrice ??
      input.baseMarketPrice + marginAmount + logisticsBuffer + riskBuffer;

    return {
      strategyUsed: input.dto.strategy,
      productId: input.dto.productId,
      marketId: input.selectedMarketPrice?.marketId,
      marketPriceId: input.selectedMarketPrice?.id,
      baseMarketPrice: input.baseMarketPrice,
      marginAmount,
      logisticsBuffer,
      riskBuffer,
      finalPrice,
      currency: input.dto.currency?.trim().toUpperCase() ?? 'NGN',
      unit: input.dto.unit,
      landedCost: input.landedCost,
      selectedMarketPrice: input.selectedMarketPrice,
      consideredMarketPrices: input.consideredMarketPrices,
      explanation: input.explanation,
    };
  }

  private findCheapest(
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    return [...marketPrices].sort(
      (first, second) =>
        this.toNumber(first.amount) - this.toNumber(second.amount),
    )[0];
  }

  private average(marketPrices: MarketPriceWithRelations[]): number {
    const total = marketPrices.reduce(
      (sum, marketPrice) => sum + this.toNumber(marketPrice.amount),
      0,
    );

    return this.roundMoney(total / marketPrices.length);
  }

  private median(marketPrices: MarketPriceWithRelations[]): number {
    const sortedAmounts = marketPrices
      .map((marketPrice) => this.toNumber(marketPrice.amount))
      .sort((first, second) => first - second);
    const middle = Math.floor(sortedAmounts.length / 2);

    if (sortedAmounts.length % 2 === 1) {
      return sortedAmounts[middle];
    }

    return this.roundMoney((sortedAmounts[middle - 1] + sortedAmounts[middle]) / 2);
  }

  private findPreferredMarketPrice(
    dto: CalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    if (!dto.preferredMarketId) {
      throw new BadRequestException(
        'preferredMarketId is required for preferred_market strategy',
      );
    }

    return this.findLatestByMarket(marketPrices, dto.preferredMarketId);
  }

  private findSingleMarketPrice(
    dto: CalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    if (!dto.marketId) {
      throw new BadRequestException('marketId is required for single_market strategy');
    }

    return this.findLatestByMarket(marketPrices, dto.marketId);
  }

  private findQualityFirst(
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    const qualityRank: Record<PriceQualityGrade, number> = {
      premium: 3,
      standard: 2,
      low: 1,
    };

    return [...marketPrices].sort((first, second) => {
      const qualityDifference =
        qualityRank[second.qualityGrade] - qualityRank[first.qualityGrade];

      if (qualityDifference !== 0) {
        return qualityDifference;
      }

      return this.toNumber(first.amount) - this.toNumber(second.amount);
    })[0];
  }

  private findFastestFulfillment(
    dto: CalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    if (!dto.marketPriorityIds?.length) {
      return marketPrices[0];
    }

    for (const marketId of dto.marketPriorityIds) {
      const marketPrice = marketPrices.find((price) => price.marketId === marketId);

      if (marketPrice) {
        return marketPrice;
      }
    }

    throw new NotFoundException(
      'No market price found in the fulfillment priority list',
    );
  }

  private async calculateHybridLandedCost(
    dto: CalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): Promise<StrategyResult> {
    const logisticsCostByMarket = await this.getLogisticsCostsByMarket(dto);
    const selectedMarketPrice = this.findHybridLandedCost(
      marketPrices,
      logisticsCostByMarket,
    );
    const logisticsBuffer =
      dto.logisticsBuffer ?? logisticsCostByMarket.get(selectedMarketPrice.marketId) ?? 0;
    const landedCost =
      this.toNumber(selectedMarketPrice.amount) +
      (logisticsCostByMarket.get(selectedMarketPrice.marketId) ?? 0);

    return this.buildResult({
      dto,
      selectedMarketPrice,
      consideredMarketPrices: marketPrices,
      baseMarketPrice: this.toNumber(selectedMarketPrice.amount),
      logisticsBuffer,
      landedCost,
      explanation:
        'Selected the lowest landed cost: market price plus configured logistics cost.',
    });
  }

  private findHybridLandedCost(
    marketPrices: MarketPriceWithRelations[],
    logisticsCostByMarket: Map<string, number>,
  ): MarketPriceWithRelations {

    return [...marketPrices].sort((first, second) => {
      const firstTotal =
        this.toNumber(first.amount) + (logisticsCostByMarket.get(first.marketId) ?? 0);
      const secondTotal =
        this.toNumber(second.amount) +
        (logisticsCostByMarket.get(second.marketId) ?? 0);

      return firstTotal - secondTotal;
    })[0];
  }

  private async getLogisticsCostsByMarket(
    dto: CalculateBuyPriceDto,
  ): Promise<Map<string, number>> {
    if (dto.marketLogisticsCosts?.length) {
      return new Map(
        dto.marketLogisticsCosts.map((item) => [item.marketId, item.cost]),
      );
    }

    if (!dto.deliveryZoneId) {
      return new Map();
    }

    const deliveryCosts = await this.prisma.marketDeliveryCost.findMany({
      where: {
        deliveryZoneId: dto.deliveryZoneId,
        isActive: true,
      },
    });

    return new Map(
      deliveryCosts.map((deliveryCost) => [
        deliveryCost.marketId,
        this.toNumber(deliveryCost.cost),
      ]),
    );
  }

  private findLatestByMarket(
    marketPrices: MarketPriceWithRelations[],
    marketId: string,
  ): MarketPriceWithRelations {
    const marketPrice = marketPrices.find((price) => price.marketId === marketId);

    if (!marketPrice) {
      throw new NotFoundException('No matching market price found for this market');
    }

    return marketPrice;
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private toStartDate(value: string): Date {
    const date = new Date(value);

    if (this.isDateOnly(value)) {
      date.setHours(0, 0, 0, 0);
    }

    return date;
  }

  private toEndDate(value: string): Date {
    const date = new Date(value);

    if (this.isDateOnly(value)) {
      date.setHours(23, 59, 59, 999);
    }

    return date;
  }

  private isDateOnly(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
}
