import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MarketAnalysisSnapshotStatus,
  MarketAnalysisTrend,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateMarketAnalysisBenchmarkDto,
  UpdateMarketAnalysisBenchmarkDto,
} from './dto/market-analysis.dto';

const BENCHMARK_INCLUDE = {
  productOffering: {
    include: {
      product: true,
      variant: true,
      brand: true,
      package: true,
    },
  },
  markets: { include: { market: true } },
} satisfies Prisma.MarketAnalysisBenchmarkInclude;

@Injectable()
export class MarketAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async createBenchmark(dto: CreateMarketAnalysisBenchmarkDto) {
    await this.validateReferences(dto.productOfferingId, dto.marketIds);
    try {
      const benchmark = await this.prisma.marketAnalysisBenchmark.create({
        data: {
          productOfferingId: dto.productOfferingId,
          name: dto.name.trim(),
          currency: dto.currency?.trim().toUpperCase(),
          isActive: dto.isActive,
          markets: {
            create: [...new Set(dto.marketIds)].map((marketId) => ({
              marketId,
            })),
          },
        },
        include: BENCHMARK_INCLUDE,
      });
      return { message: 'Market analysis benchmark created.', benchmark };
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'A benchmark already exists for this product offering',
        );
      }
      throw error;
    }
  }

  async findBenchmarks() {
    const data = await this.prisma.marketAnalysisBenchmark.findMany({
      include: BENCHMARK_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return { data };
  }

  async updateBenchmark(id: string, dto: UpdateMarketAnalysisBenchmarkDto) {
    const existing = await this.prisma.marketAnalysisBenchmark.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Benchmark not found');
    if (dto.marketIds) {
      await this.validateReferences(existing.productOfferingId, dto.marketIds);
    }

    const benchmark = await this.prisma.$transaction(async (tx) => {
      if (dto.marketIds) {
        await tx.marketAnalysisBenchmarkMarket.deleteMany({
          where: { benchmarkId: id },
        });
      }
      return tx.marketAnalysisBenchmark.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          currency: dto.currency?.trim().toUpperCase(),
          isActive: dto.isActive,
          markets: dto.marketIds
            ? {
                create: [...new Set(dto.marketIds)].map((marketId) => ({
                  marketId,
                })),
              }
            : undefined,
        },
        include: BENCHMARK_INCLUDE,
      });
    });
    return { message: 'Market analysis benchmark updated.', benchmark };
  }

  async removeBenchmark(id: string) {
    const deleted = await this.prisma.marketAnalysisBenchmark.deleteMany({
      where: { id },
    });
    if (deleted.count !== 1) throw new NotFoundException('Benchmark not found');
    return { message: 'Market analysis benchmark deleted.' };
  }

  async latest() {
    const snapshot = await this.prisma.marketAnalysisSnapshot.findFirst({
      where: { status: MarketAnalysisSnapshotStatus.completed },
      include: { items: { orderBy: { productName: 'asc' } } },
      orderBy: { analysisDate: 'desc' },
    });
    return snapshot
      ? { snapshot }
      : { snapshot: null, items: [], message: 'No completed analysis yet.' };
  }

  async runDaily(input?: string) {
    const analysisDate = this.analysisDate(input);
    const acquired = await this.acquireSnapshot(analysisDate);
    if (!acquired.shouldRun) {
      return {
        message:
          acquired.snapshot.status === MarketAnalysisSnapshotStatus.completed
            ? 'Analysis already completed for this date.'
            : 'Analysis is already processing for this date.',
        snapshot: acquired.snapshot,
      };
    }

    try {
      const items = await this.calculateItems(analysisDate);
      const snapshot = await this.prisma.$transaction(async (tx) => {
        await tx.marketAnalysisSnapshotItem.deleteMany({
          where: { snapshotId: acquired.snapshot.id },
        });
        if (items.length) {
          await tx.marketAnalysisSnapshotItem.createMany({
            data: items.map((item) => ({
              ...item,
              snapshotId: acquired.snapshot.id,
            })),
          });
        }
        return tx.marketAnalysisSnapshot.update({
          where: { id: acquired.snapshot.id },
          data: {
            status: MarketAnalysisSnapshotStatus.completed,
            completedAt: new Date(),
            errorMessage: null,
          },
          include: { items: { orderBy: { productName: 'asc' } } },
        });
      });
      return { message: 'Daily market analysis completed.', snapshot };
    } catch (error) {
      await this.prisma.marketAnalysisSnapshot.update({
        where: { id: acquired.snapshot.id },
        data: {
          status: MarketAnalysisSnapshotStatus.failed,
          completedAt: new Date(),
          errorMessage:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : String(error),
        },
      });
      throw error;
    }
  }

  private async calculateItems(analysisDate: Date) {
    const benchmarks = await this.prisma.marketAnalysisBenchmark.findMany({
      where: { isActive: true },
      include: BENCHMARK_INCLUDE,
      orderBy: { name: 'asc' },
    });
    const previous = await this.prisma.marketAnalysisSnapshot.findFirst({
      where: {
        status: MarketAnalysisSnapshotStatus.completed,
        analysisDate: { lt: analysisDate },
      },
      include: { items: true },
      orderBy: { analysisDate: 'desc' },
    });
    const previousByOffering = new Map(
      (previous?.items ?? []).map((item) => [item.productOfferingId, item]),
    );
    const window = this.collectionWindow(analysisDate);

    return Promise.all(
      benchmarks.map(async (benchmark) => {
        const observations = await this.prisma.marketPrice.findMany({
          where: {
            productOfferingId: benchmark.productOfferingId,
            marketId: {
              in: benchmark.markets.map((entry) => entry.marketId),
            },
            currency: benchmark.currency,
            observedAt: { gte: window.start, lte: window.end },
          },
          orderBy: { observedAt: 'desc' },
        });
        const latestByMarket = new Map<string, (typeof observations)[number]>();
        for (const observation of observations) {
          if (!latestByMarket.has(observation.marketId)) {
            latestByMarket.set(observation.marketId, observation);
          }
        }
        const selected = [...latestByMarket.values()];
        const currentPrice = selected.length
          ? this.median(selected.map((item) => this.number(item.amount)))
          : undefined;
        const previousRecord = previousByOffering.get(
          benchmark.productOfferingId,
        );
        const previousPrice = previousRecord?.currentPrice
          ? this.number(previousRecord.currentPrice)
          : undefined;
        const changePercentage =
          currentPrice !== undefined &&
          previousPrice !== undefined &&
          previousPrice !== 0
            ? this.round(((currentPrice - previousPrice) / previousPrice) * 100)
            : undefined;

        return {
          productId: benchmark.productOffering.productId,
          productOfferingId: benchmark.productOfferingId,
          productName: benchmark.productOffering.product.name,
          variantName: benchmark.productOffering.variant?.name,
          brandName: benchmark.productOffering.brand?.name,
          packageName: benchmark.productOffering.package.name,
          currentPrice,
          previousPrice,
          changePercentage,
          trend: this.trend(currentPrice, previousPrice),
          currency: benchmark.currency,
          observationCount: selected.length,
          lastPriceAt: selected[0]?.observedAt,
        };
      }),
    );
  }

  private async acquireSnapshot(analysisDate: Date) {
    const existing = await this.prisma.marketAnalysisSnapshot.findUnique({
      where: { analysisDate },
    });
    if (
      existing?.status === MarketAnalysisSnapshotStatus.completed ||
      existing?.status === MarketAnalysisSnapshotStatus.processing
    ) {
      return { snapshot: existing, shouldRun: false };
    }
    if (existing) {
      const snapshot = await this.prisma.marketAnalysisSnapshot.update({
        where: { id: existing.id },
        data: {
          status: MarketAnalysisSnapshotStatus.processing,
          startedAt: new Date(),
          completedAt: null,
          errorMessage: null,
        },
      });
      return { snapshot, shouldRun: true };
    }
    try {
      const snapshot = await this.prisma.marketAnalysisSnapshot.create({
        data: { analysisDate },
      });
      return { snapshot, shouldRun: true };
    } catch (error) {
      if (!this.isUniqueConstraint(error)) throw error;
      const snapshot =
        await this.prisma.marketAnalysisSnapshot.findUniqueOrThrow({
          where: { analysisDate },
        });
      return { snapshot, shouldRun: false };
    }
  }

  private async validateReferences(
    productOfferingId: string,
    marketIds: string[],
  ) {
    const uniqueMarketIds = [...new Set(marketIds)];
    const [offering, count] = await Promise.all([
      this.prisma.productOffering.findUnique({
        where: { id: productOfferingId },
        select: { id: true, isActive: true },
      }),
      this.prisma.market.count({
        where: { id: { in: uniqueMarketIds }, status: 'active' },
      }),
    ]);
    if (!offering) throw new NotFoundException('Product offering not found');
    if (!offering.isActive) {
      throw new BadRequestException('Product offering is not active');
    }
    if (count !== uniqueMarketIds.length) {
      throw new BadRequestException(
        'One or more selected markets do not exist or are inactive',
      );
    }
  }

  private collectionWindow(date: Date) {
    const startHour = this.hour(
      process.env.MARKET_ANALYSIS_WINDOW_START_HOUR_UTC,
      0,
    );
    const endHour = this.hour(
      process.env.MARKET_ANALYSIS_WINDOW_END_HOUR_UTC,
      23,
    );
    if (endHour < startHour) {
      throw new BadRequestException(
        'Market analysis end hour cannot be before the start hour',
      );
    }
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return {
      start: new Date(Date.UTC(year, month, day, startHour, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, day, endHour, 59, 59, 999)),
    };
  }

  private analysisDate(value?: string) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('analysisDate must be a valid date');
    }
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private hour(value: string | undefined, fallback: number) {
    const parsed = value === undefined ? fallback : Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
      throw new BadRequestException(
        'Market analysis collection hours must be between 0 and 23',
      );
    }
    return parsed;
  }

  private median(values: number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : this.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  private trend(current?: number, previous?: number) {
    if (current === undefined || previous === undefined) {
      return MarketAnalysisTrend.unavailable;
    }
    if (current > previous) return MarketAnalysisTrend.up;
    if (current < previous) return MarketAnalysisTrend.down;
    return MarketAnalysisTrend.unchanged;
  }

  private number(value: Prisma.Decimal | number) {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
