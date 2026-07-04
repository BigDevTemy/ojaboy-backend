import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BuyPriceStrategy,
  MarketPrice,
  PriceQualityGrade,
  PriceUnit,
  Prisma,
  ProductOffering,
  ProductPackage,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { BulkCalculateBuyPricesDto } from './dto/bulk-calculate-buy-prices.dto';
import { BuyPriceQueryDto } from './dto/buy-price-query.dto';
import { CalculateBuyPriceDto } from './dto/calculate-buy-price.dto';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';

type MarketPriceWithRelations = MarketPrice & {
  market: { id: string; marketname: string; marketaddress: string | null };
  product: { id: string; name: string; sku: string };
  productOffering: {
    id: string;
    sku: string;
    variant: { id: string; name: string; code: string } | null;
    brand: { id: string; name: string } | null;
    package: { id: string; name: string };
  } | null;
  priceUnit: PriceUnit;
};

export type BulkTarget = {
  productId: string;
  productOfferingId: string | null;
  unit: string;
};

type ProductOfferingWithPackage = ProductOffering & {
  package: ProductPackage;
};

type ResolvedCalculateBuyPriceDto = Omit<CalculateBuyPriceDto, 'unit'> & {
  priceUnit: PriceUnit;
};

type ResolvedCreatePriceDto = Omit<CreatePriceDto, 'unit'> & {
  priceUnit: PriceUnit;
};

export type StrategyResult = {
  strategyUsed: BuyPriceStrategy;
  productId: string;
  productOfferingId?: string;
  marketId?: string;
  marketPriceId?: string;
  baseMarketPrice: number;
  marginAmount: number;
  logisticsBuffer: number;
  riskBuffer: number;
  finalPrice: number;
  currency: string;
  priceUnitId: string;
  priceUnit: PriceUnit;
  landedCost?: number;
  selectedMarketPrice?: MarketPriceWithRelations;
  consideredMarketPrices: MarketPriceWithRelations[];
  explanation: string;
};

@Injectable()
export class PricesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async create(createPriceDto: CreatePriceDto) {
    this.requireOfferingId(createPriceDto.productOfferingId);
    const offering = await this.validatePriceReferences(
      createPriceDto.productId,
      createPriceDto.productOfferingId,
      createPriceDto.marketPriceId,
    );
    if (!offering) {
      throw new BadRequestException('Product offering does not exist');
    }
    const { unit: _unit, ...createPriceRest } = createPriceDto;
    const resolvedPriceDto: ResolvedCreatePriceDto = {
      ...createPriceRest,
      priceUnit: await this.resolvePriceUnit(
        createPriceDto.unit,
        offering.package,
      ),
    };
    const price = await this.prisma.$transaction(async (tx) => {
      if (resolvedPriceDto.isActive ?? true) {
        await tx.buyPrice.updateMany({
          where: {
            ...this.activePriceIdentity({
              productId: resolvedPriceDto.productId,
              productOfferingId: resolvedPriceDto.productOfferingId,
              priceUnitId: resolvedPriceDto.priceUnit.id,
            }),
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return tx.buyPrice.create({
        data: this.toPriceData(resolvedPriceDto),
        include: this.priceRelations(),
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
          where: {
            ...this.activePriceIdentity(result),
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      return tx.buyPrice.create({
        data: {
          productId: result.productId,
          productOfferingId: result.productOfferingId,
          marketId: result.marketId,
          marketPriceId: result.marketPriceId,
          baseMarketPrice: result.baseMarketPrice,
          marginAmount: result.marginAmount,
          logisticsBuffer: result.logisticsBuffer,
          riskBuffer: result.riskBuffer,
          finalPrice: result.finalPrice,
          currency: result.currency,
          priceUnitId: result.priceUnitId,
          strategyUsed: result.strategyUsed,
          isActive: calculateBuyPriceDto.isActive,
          validFrom: calculateBuyPriceDto.validFrom
            ? new Date(calculateBuyPriceDto.validFrom)
            : undefined,
          validUntil: calculateBuyPriceDto.validUntil
            ? new Date(calculateBuyPriceDto.validUntil)
            : undefined,
        },
        include: this.priceRelations(),
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
    const prices = await this.persistGeneratedResults(
      bulkCalculateBuyPricesDto,
      results,
    );

    return {
      message: 'Bulk buy prices generated successfully.',
      count: prices.length,
      prices,
    };
  }

  /**
   * Writes a batch of already-computed StrategyResults as real BuyPrice
   * rows (deactivating conflicting actives first). Used both by the
   * synchronous generateBulk() and, one batch at a time, by
   * BulkPriceJobsService.processNextBatch() for generate-mode jobs.
   */
  async persistGeneratedResults(
    dto: BulkCalculateBuyPricesDto,
    results: StrategyResult[],
  ) {
    if (results.length === 0) return [];

    const isActive = dto.isActive ?? true;
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : undefined;
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : undefined;
    const priceData = results.map((result) => ({
      id: randomUUID(),
      productId: result.productId,
      productOfferingId: result.productOfferingId,
      marketId: result.marketId,
      marketPriceId: result.marketPriceId,
      baseMarketPrice: result.baseMarketPrice,
      marginAmount: result.marginAmount,
      logisticsBuffer: result.logisticsBuffer,
      riskBuffer: result.riskBuffer,
      finalPrice: result.finalPrice,
      currency: result.currency,
      priceUnitId: result.priceUnitId,
      strategyUsed: result.strategyUsed,
      isActive,
      validFrom,
      validUntil,
    }));

    await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.buyPrice.updateMany({
          where: {
            OR: results.map((result) => this.activePriceIdentity(result)),
            isActive: true,
          },
          data: { isActive: false },
        });
      }

      await tx.buyPrice.createMany({ data: priceData });
    });

    return this.prisma.buyPrice.findMany({
      where: { id: { in: priceData.map((price) => price.id) } },
      include: this.priceRelations(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(filters: BuyPriceQueryDto = new BuyPriceQueryDto()) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;
    const where = await this.toBuyPriceWhere(filters);
    const [prices, total] = await this.prisma.$transaction([
      this.prisma.buyPrice.findMany({
        where,
        include: this.priceRelations(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.buyPrice.count({ where }),
    ]);

    return {
      data: prices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByProduct(productId: string) {
    const prices = await this.prisma.buyPrice.findMany({
      where: { productId },
      include: this.priceRelations(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: prices };
  }

  async findByMarket(marketId: string) {
    const prices = await this.prisma.buyPrice.findMany({
      where: { marketId },
      include: this.priceRelations(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: prices };
  }

  async findActiveByProduct(productId: string) {
    const price = await this.prisma.buyPrice.findFirst({
      where: { productId, isActive: true },
      include: this.priceRelations(),
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
      include: this.priceRelations(),
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
      const productOfferingId =
        updatePriceDto.productOfferingId === undefined
          ? (existingPrice.productOfferingId ?? undefined)
          : updatePriceDto.productOfferingId;
      this.requireOfferingId(
        productOfferingId,
        'A productOfferingId must be assigned before updating this legacy buy price',
      );
      await this.validatePriceReferences(
        existingPrice.productId,
        productOfferingId,
        updatePriceDto.marketPriceId ??
          existingPrice.marketPriceId ??
          undefined,
      );
      const priceUnit = updatePriceDto.unit
        ? await this.priceUnitsService.requireByCode(updatePriceDto.unit)
        : undefined;

      const price = await this.prisma.$transaction(async (tx) => {
        if (updatePriceDto.isActive ?? existingPrice.isActive) {
          await tx.buyPrice.updateMany({
            where: {
              ...this.activePriceIdentity({
                productId: existingPrice.productId,
                productOfferingId,
                priceUnitId: priceUnit?.id ?? existingPrice.priceUnitId,
              }),
              isActive: true,
              id: { not: id },
            },
            data: { isActive: false },
          });
        }

        return tx.buyPrice.update({
          where: { id },
          data: this.toUpdateData(updatePriceDto, priceUnit?.id),
          include: this.priceRelations(),
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
          ...this.activePriceIdentity(existingPrice),
          isActive: true,
          id: { not: id },
        },
        data: { isActive: false },
      });

      return tx.buyPrice.update({
        where: { id },
        data: { isActive: true },
        include: this.priceRelations(),
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

  private toPriceData(
    dto: ResolvedCreatePriceDto,
  ): Prisma.BuyPriceUncheckedCreateInput {
    const finalPrice =
      dto.finalPrice ??
      dto.baseMarketPrice +
        (dto.marginAmount ?? 0) +
        (dto.logisticsBuffer ?? 0) +
        (dto.riskBuffer ?? 0);

    return {
      productId: dto.productId,
      productOfferingId: dto.productOfferingId,
      marketId: dto.marketId,
      marketPriceId: dto.marketPriceId,
      baseMarketPrice: dto.baseMarketPrice,
      marginAmount: dto.marginAmount,
      logisticsBuffer: dto.logisticsBuffer,
      riskBuffer: dto.riskBuffer,
      finalPrice,
      currency: dto.currency?.trim().toUpperCase(),
      priceUnitId: dto.priceUnit.id,
      strategyUsed: dto.strategyUsed,
      isActive: dto.isActive,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
  }

  private toUpdateData(
    dto: UpdatePriceDto,
    priceUnitId?: string,
  ): Prisma.BuyPriceUncheckedUpdateInput {
    return {
      productOfferingId: dto.productOfferingId,
      marketId: dto.marketId,
      marketPriceId: dto.marketPriceId,
      baseMarketPrice: dto.baseMarketPrice,
      marginAmount: dto.marginAmount,
      logisticsBuffer: dto.logisticsBuffer,
      riskBuffer: dto.riskBuffer,
      finalPrice: dto.finalPrice,
      currency: dto.currency?.trim().toUpperCase(),
      priceUnitId,
      strategyUsed: dto.strategyUsed,
      isActive: dto.isActive,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
    };
  }

  private async toBuyPriceWhere(
    filters: BuyPriceQueryDto,
  ): Promise<Prisma.BuyPriceWhereInput> {
    const search = filters.search?.trim();
    const validFrom = filters.validFrom
      ? new Date(filters.validFrom)
      : undefined;
    const validTo = filters.validTo ? new Date(filters.validTo) : undefined;

    if (validFrom && validTo && validFrom > validTo) {
      throw new BadRequestException('validFrom must be before validTo');
    }

    const productOfferingWhere: Prisma.ProductOfferingWhereInput = {
      variantId: filters.variantId,
      brandId: filters.brandId,
      packageId: filters.packageId,
    };
    const productOfferingSearchWhere: Prisma.ProductOfferingWhereInput = {};
    const and: Prisma.BuyPriceWhereInput[] = [];

    if (validTo) {
      and.push({ validFrom: { lte: validTo } });
    }

    if (validFrom) {
      and.push({
        OR: [{ validUntil: null }, { validUntil: { gte: validFrom } }],
      });
    }

    if (search) {
      productOfferingSearchWhere.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        { variant: { name: { contains: search, mode: 'insensitive' } } },
        { variant: { code: { contains: search, mode: 'insensitive' } } },
        { brand: { name: { contains: search, mode: 'insensitive' } } },
        {
          brand: {
            manufacturer: {
              name: { contains: search, mode: 'insensitive' },
            },
          },
        },
        { package: { name: { contains: search, mode: 'insensitive' } } },
      ];

      and.push({
        OR: [
          { product: { name: { contains: search, mode: 'insensitive' } } },
          { product: { sku: { contains: search, mode: 'insensitive' } } },
          {
            product: {
              description: { contains: search, mode: 'insensitive' },
            },
          },
          {
            product: {
              category: {
                name: { contains: search, mode: 'insensitive' },
              },
            },
          },
          {
            market: {
              marketname: { contains: search, mode: 'insensitive' },
            },
          },
          {
            market: {
              marketaddress: { contains: search, mode: 'insensitive' },
            },
          },
          { marketPrice: { notes: { contains: search, mode: 'insensitive' } } },
          { productOffering: productOfferingSearchWhere },
        ],
      });
    }

    const hasProductOfferingFilters =
      filters.variantId || filters.brandId || filters.packageId;
    const priceUnit = filters.unit
      ? await this.priceUnitsService.requireByCode(filters.unit)
      : undefined;

    return {
      productId: filters.productId,
      productOfferingId: filters.productOfferingId,
      marketId: filters.marketId,
      marketPriceId: filters.marketPriceId,
      priceUnitId: priceUnit?.id,
      strategyUsed: filters.strategyUsed,
      isActive: filters.isActive,
      productOffering: hasProductOfferingFilters
        ? productOfferingWhere
        : undefined,
      AND: and.length ? and : undefined,
    };
  }

  private activePriceIdentity(input: {
    productId: string;
    productOfferingId?: string | null;
    priceUnitId: string;
  }): Prisma.BuyPriceWhereInput {
    return input.productOfferingId
      ? { productOfferingId: input.productOfferingId }
      : {
          productId: input.productId,
          productOfferingId: null,
          priceUnitId: input.priceUnitId,
        };
  }

  private priceRelations() {
    return {
      product: true,
      market: true,
      marketPrice: true,
      productOffering: {
        include: {
          variant: true,
          brand: { include: { manufacturer: true } },
          package: true,
        },
      },
      priceUnit: true,
    } satisfies Prisma.BuyPriceInclude;
  }

  private marketPriceRelations() {
    return {
      product: true,
      market: true,
      productOffering: {
        include: {
          variant: true,
          brand: true,
          package: true,
        },
      },
      priceUnit: true,
    } satisfies Prisma.MarketPriceInclude;
  }

  private async validatePriceReferences(
    productId: string,
    productOfferingId?: string,
    marketPriceId?: string,
  ): Promise<ProductOfferingWithPackage | undefined> {
    const [offering, marketPrice] = await Promise.all([
      productOfferingId
        ? this.prisma.productOffering.findUnique({
            where: { id: productOfferingId },
            include: { package: true },
          })
        : undefined,
      marketPriceId
        ? this.prisma.marketPrice.findUnique({ where: { id: marketPriceId } })
        : undefined,
    ]);

    if (productOfferingId && !offering) {
      throw new BadRequestException('Product offering does not exist');
    }
    if (offering && offering.productId !== productId) {
      throw new BadRequestException(
        'Product offering does not belong to the selected product',
      );
    }
    if (marketPriceId && !marketPrice) {
      throw new BadRequestException('Market price does not exist');
    }
    if (marketPrice && marketPrice.productId !== productId) {
      throw new BadRequestException(
        'Market price does not belong to the selected product',
      );
    }
    if (
      marketPrice &&
      marketPrice.productOfferingId !== (productOfferingId ?? null)
    ) {
      throw new BadRequestException(
        'Market price and buy price must reference the same product offering',
      );
    }

    return offering ?? undefined;
  }

  private requireOfferingId(
    productOfferingId: string | null | undefined,
    message = 'productOfferingId is required for new buy-price writes and calculations',
  ): asserts productOfferingId is string {
    if (!productOfferingId) {
      throw new BadRequestException(message);
    }
  }

  private async resolvePriceUnit(
    requestedUnit: string | undefined,
    productPackage?: ProductPackage,
  ): Promise<PriceUnit> {
    if (!productPackage) {
      if (requestedUnit) {
        return this.priceUnitsService.requireByCode(requestedUnit);
      }

      throw new BadRequestException(
        'productOfferingId must reference a package before unit can be derived',
      );
    }

    const lookup = await this.priceUnitsService.getLookup();
    const packageUnit = lookup.resolveFromPackage(productPackage);
    if (!packageUnit) {
      throw new BadRequestException(
        `Could not derive a price unit from offering package ${productPackage.name}`,
      );
    }

    if (requestedUnit) {
      const requested = await this.priceUnitsService.requireByCode(
        requestedUnit,
      );
      if (requested.id !== packageUnit.id) {
        throw new BadRequestException(
          `Requested unit ${requested.code} does not match offering package unit ${packageUnit.code}`,
        );
      }
      return requested;
    }

    return packageUnit;
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
    this.requireOfferingId(dto.productOfferingId);
    const offering = await this.validatePriceReferences(
      dto.productId,
      dto.productOfferingId,
    );
    if (!offering) {
      throw new BadRequestException('Product offering does not exist');
    }
    const { unit: _unit, ...dtoRest } = dto;
    const resolvedDto: ResolvedCalculateBuyPriceDto = {
      ...dtoRest,
      priceUnit: await this.resolvePriceUnit(dto.unit, offering.package),
    };

    if (resolvedDto.strategy === BuyPriceStrategy.manual_override) {
      return this.calculateManualOverride(resolvedDto);
    }

    const marketPrices = await this.findMarketPricesForStrategy(resolvedDto);

    if (marketPrices.length === 0) {
      throw new NotFoundException('No market prices found for this strategy');
    }

    switch (resolvedDto.strategy) {
      case BuyPriceStrategy.cheapest:
        return this.fromSelectedMarketPrice(
          resolvedDto,
          this.findCheapest(marketPrices),
          marketPrices,
          'Selected the lowest observed market price.',
        );
      case BuyPriceStrategy.average:
        return this.fromAggregatePrice(
          resolvedDto,
          this.average(marketPrices),
          marketPrices,
          'Used the average of matching market prices.',
        );
      case BuyPriceStrategy.median:
        return this.fromAggregatePrice(
          resolvedDto,
          this.median(marketPrices),
          marketPrices,
          'Used the median of matching market prices.',
        );
      case BuyPriceStrategy.preferred_market:
        return this.fromSelectedMarketPrice(
          resolvedDto,
          this.findPreferredMarketPrice(resolvedDto, marketPrices),
          marketPrices,
          'Selected the latest price from the configured preferred market.',
        );
      case BuyPriceStrategy.single_market:
        return this.fromSelectedMarketPrice(
          resolvedDto,
          this.findSingleMarketPrice(resolvedDto, marketPrices),
          marketPrices,
          'Selected the latest price from one configured market.',
        );
      case BuyPriceStrategy.quality_first:
        return this.fromSelectedMarketPrice(
          resolvedDto,
          this.findQualityFirst(marketPrices),
          marketPrices,
          'Selected the best available quality grade, then lowest price.',
        );
      case BuyPriceStrategy.fastest_fulfillment:
        return this.fromSelectedMarketPrice(
          resolvedDto,
          this.findFastestFulfillment(resolvedDto, marketPrices),
          marketPrices,
          'Selected the first available market from the fulfillment priority list.',
        );
      case BuyPriceStrategy.hybrid_landed_cost:
        return this.calculateHybridLandedCost(resolvedDto, marketPrices);
      default:
        throw new BadRequestException('Unsupported buy price strategy');
    }
  }

  async findBulkTargets(
    dto: BulkCalculateBuyPricesDto,
  ): Promise<BulkTarget[]> {
    const priceUnit = dto.unit
      ? await this.priceUnitsService.requireByCode(dto.unit)
      : undefined;
    const commonWhere = {
      productId: dto.productIds?.length ? { in: dto.productIds } : undefined,
      priceUnitId: priceUnit?.id,
      // A price of 0 means "not yet known" (e.g. catalogued before a market
      // observation exists) and must never be treated as a real signal.
      amount: { gt: 0 },
      product: dto.categoryId ? { categoryId: dto.categoryId } : undefined,
      observedAt:
        dto.observedFrom || dto.observedTo
          ? {
              gte: dto.observedFrom
                ? this.toStartDate(dto.observedFrom)
                : undefined,
              lte: dto.observedTo ? this.toEndDate(dto.observedTo) : undefined,
            }
          : undefined,
    } satisfies Prisma.MarketPriceWhereInput;

    const detailedTargets = await this.prisma.marketPrice.findMany({
      where: {
        ...commonWhere,
        productOfferingId: dto.productOfferingIds?.length
          ? { in: dto.productOfferingIds }
          : { not: null },
      },
      distinct: ['productOfferingId'],
      select: {
        productId: true,
        productOfferingId: true,
        priceUnit: { select: { code: true } },
      },
      orderBy: { observedAt: 'desc' },
    });

    const targets = detailedTargets.map((target) => ({
      productId: target.productId,
      productOfferingId: target.productOfferingId,
      unit: target.priceUnit.code,
    }));

    if (targets.length === 0) {
      throw new NotFoundException(
        'No products found for bulk buy price calculation',
      );
    }

    return targets;
  }

  // Kept comfortably below the DB connection pool size (DATABASE_POOL_MAX,
  // default 5 - see prisma.service.ts) so a bulk calculation over many
  // offerings can't exhaust the pool on its own and starve every other
  // concurrent request. Each target runs several sequential queries, so
  // running all of them at once previously meant one Promise.all per
  // offering, all competing for the same handful of connections. Also used
  // by BulkPriceJobsService as the batch size for one process-next call.
  static readonly BULK_CALCULATION_CONCURRENCY = 3;

  /** Runs calculateStrategy for one batch of targets concurrently. */
  async calculateStrategyBatch(
    dto: BulkCalculateBuyPricesDto,
    batch: BulkTarget[],
  ): Promise<StrategyResult[]> {
    return Promise.all(
      batch.map((target) => {
        this.requireOfferingId(target.productOfferingId);
        return this.calculateStrategy({
          productId: target.productId,
          productOfferingId: target.productOfferingId,
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
      }),
    );
  }

  private async calculateBulkTargets(
    dto: BulkCalculateBuyPricesDto,
    targets: BulkTarget[],
  ): Promise<StrategyResult[]> {
    const results: StrategyResult[] = [];

    for (
      let index = 0;
      index < targets.length;
      index += PricesService.BULK_CALCULATION_CONCURRENCY
    ) {
      const batch = targets.slice(
        index,
        index + PricesService.BULK_CALCULATION_CONCURRENCY,
      );
      results.push(...(await this.calculateStrategyBatch(dto, batch)));
    }

    return results;
  }

  private async findMarketPricesForStrategy(
    dto: ResolvedCalculateBuyPriceDto,
  ): Promise<MarketPriceWithRelations[]> {
    return this.prisma.marketPrice.findMany({
      where: {
        productId: dto.productId,
        productOfferingId: dto.productOfferingId,
        priceUnitId: dto.priceUnit.id,
        // A price of 0 means "not yet known" and must be left out of every
        // buy-price strategy (cheapest, average, median, etc.).
        amount: { gt: 0 },
        observedAt:
          dto.observedFrom || dto.observedTo
            ? {
                gte: dto.observedFrom
                  ? this.toStartDate(dto.observedFrom)
                  : undefined,
                lte: dto.observedTo
                  ? this.toEndDate(dto.observedTo)
                  : undefined,
              }
            : undefined,
      },
      include: this.marketPriceRelations(),
      orderBy: { observedAt: 'desc' },
    });
  }

  private calculateManualOverride(
    dto: ResolvedCalculateBuyPriceDto,
  ): StrategyResult {
    if (
      dto.manualFinalPrice === undefined &&
      dto.manualBaseMarketPrice === undefined
    ) {
      throw new BadRequestException(
        'manualFinalPrice or manualBaseMarketPrice is required for manual override',
      );
    }

    const baseMarketPrice =
      dto.manualBaseMarketPrice ?? dto.manualFinalPrice ?? 0;

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
    dto: ResolvedCalculateBuyPriceDto,
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
    dto: ResolvedCalculateBuyPriceDto,
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
    dto: ResolvedCalculateBuyPriceDto;
    baseMarketPrice: number;
    consideredMarketPrices: MarketPriceWithRelations[];
    explanation: string;
    selectedMarketPrice?: MarketPriceWithRelations;
    logisticsBuffer?: number;
    landedCost?: number;
    finalPrice?: number;
  }): StrategyResult {
    const marginAmount = input.dto.marginAmount ?? 0;
    const logisticsBuffer =
      input.logisticsBuffer ?? input.dto.logisticsBuffer ?? 0;
    const riskBuffer = input.dto.riskBuffer ?? 0;
    const finalPrice =
      input.finalPrice ??
      input.baseMarketPrice + marginAmount + logisticsBuffer + riskBuffer;

    return {
      strategyUsed: input.dto.strategy,
      productId: input.dto.productId,
      productOfferingId: input.dto.productOfferingId,
      marketId: input.selectedMarketPrice?.marketId,
      marketPriceId: input.selectedMarketPrice?.id,
      baseMarketPrice: input.baseMarketPrice,
      marginAmount,
      logisticsBuffer,
      riskBuffer,
      finalPrice,
      currency: input.dto.currency?.trim().toUpperCase() ?? 'NGN',
      priceUnitId: input.dto.priceUnit.id,
      priceUnit: input.dto.priceUnit,
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

    return this.roundMoney(
      (sortedAmounts[middle - 1] + sortedAmounts[middle]) / 2,
    );
  }

  private findPreferredMarketPrice(
    dto: ResolvedCalculateBuyPriceDto,
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
    dto: ResolvedCalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    if (!dto.marketId) {
      throw new BadRequestException(
        'marketId is required for single_market strategy',
      );
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
    dto: ResolvedCalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): MarketPriceWithRelations {
    if (!dto.marketPriorityIds?.length) {
      return marketPrices[0];
    }

    for (const marketId of dto.marketPriorityIds) {
      const marketPrice = marketPrices.find(
        (price) => price.marketId === marketId,
      );

      if (marketPrice) {
        return marketPrice;
      }
    }

    throw new NotFoundException(
      'No market price found in the fulfillment priority list',
    );
  }

  private async calculateHybridLandedCost(
    dto: ResolvedCalculateBuyPriceDto,
    marketPrices: MarketPriceWithRelations[],
  ): Promise<StrategyResult> {
    const logisticsCostByMarket = await this.getLogisticsCostsByMarket(dto);
    const selectedMarketPrice = this.findHybridLandedCost(
      marketPrices,
      logisticsCostByMarket,
    );
    const logisticsBuffer =
      dto.logisticsBuffer ??
      logisticsCostByMarket.get(selectedMarketPrice.marketId) ??
      0;
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
        this.toNumber(first.amount) +
        (logisticsCostByMarket.get(first.marketId) ?? 0);
      const secondTotal =
        this.toNumber(second.amount) +
        (logisticsCostByMarket.get(second.marketId) ?? 0);

      return firstTotal - secondTotal;
    })[0];
  }

  private async getLogisticsCostsByMarket(
    dto: ResolvedCalculateBuyPriceDto,
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
    const marketPrice = marketPrices.find(
      (price) => price.marketId === marketId,
    );

    if (!marketPrice) {
      throw new NotFoundException(
        'No matching market price found for this market',
      );
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
