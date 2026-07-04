import { Injectable, NotFoundException } from '@nestjs/common';
import { BulkPriceJobMode, BulkPriceJobStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BulkCalculateBuyPricesDto } from './dto/bulk-calculate-buy-prices.dto';
import { BulkTarget, PricesService, StrategyResult } from './prices.service';

type JobResultSummary = {
  productId: string;
  productOfferingId?: string | null;
  buyPriceId?: string;
  strategyUsed: string;
  baseMarketPrice: number;
  marginAmount: number;
  logisticsBuffer: number;
  riskBuffer: number;
  finalPrice: number;
  landedCost?: number | null;
  currency: string;
  priceUnitId: string;
  priceUnitCode: string;
  explanation: string;
};

/**
 * Runs a bulk buy-price calculate/generate request as a resumable job
 * processed in small batches, so the frontend can drive it forward one
 * batch at a time (see prices.controller.ts) and show live progress
 * instead of a single request that blocks for a minute or more.
 *
 * Deliberately does NOT keep processing in the background after a request
 * returns - Cloud Run only guarantees CPU while a request is in flight
 * (unless "CPU always allocated" is configured), so every unit of work
 * happens inside processNextBatch(), called by the frontend in a loop.
 */
@Injectable()
export class BulkPriceJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricesService: PricesService,
  ) {}

  async createJob(dto: BulkCalculateBuyPricesDto, mode: BulkPriceJobMode) {
    const targets = await this.pricesService.findBulkTargets(dto);

    const job = await this.prisma.bulkPriceJob.create({
      data: {
        mode,
        strategy: dto.strategy,
        requestParams: dto as unknown as Prisma.InputJsonValue,
        targets: targets as unknown as Prisma.InputJsonValue,
        totalTargets: targets.length,
      },
    });

    return this.toJobResponse(job);
  }

  async getJob(jobId: string) {
    const job = await this.requireJob(jobId);
    return this.toJobResponse(job);
  }

  async processNextBatch(jobId: string) {
    const job = await this.requireJob(jobId);

    if (
      job.status === BulkPriceJobStatus.completed ||
      job.status === BulkPriceJobStatus.failed
    ) {
      return this.toJobResponse(job);
    }

    const targets = job.targets as unknown as BulkTarget[];
    const dto = job.requestParams as unknown as BulkCalculateBuyPricesDto;
    const batch = targets.slice(
      job.processedTargets,
      job.processedTargets + PricesService.BULK_CALCULATION_CONCURRENCY,
    );

    if (batch.length === 0) {
      const completed = await this.prisma.bulkPriceJob.update({
        where: { id: job.id },
        data: {
          status: BulkPriceJobStatus.completed,
          completedAt: job.completedAt ?? new Date(),
        },
      });
      return this.toJobResponse(completed);
    }

    try {
      const batchResults = await this.pricesService.calculateStrategyBatch(
        dto,
        batch,
      );
      const summaries = await this.summarizeBatch(dto, job.mode, batchResults);
      const processedTargets = job.processedTargets + batch.length;
      const done = processedTargets >= job.totalTargets;

      const updated = await this.prisma.bulkPriceJob.update({
        where: { id: job.id },
        data: {
          status: done
            ? BulkPriceJobStatus.completed
            : BulkPriceJobStatus.processing,
          startedAt: job.startedAt ?? new Date(),
          completedAt: done ? new Date() : undefined,
          processedTargets,
          results: [
            ...(job.results as unknown as JobResultSummary[]),
            ...summaries,
          ] as unknown as Prisma.InputJsonValue,
        },
      });

      return this.toJobResponse(updated);
    } catch (error) {
      const failed = await this.prisma.bulkPriceJob.update({
        where: { id: job.id },
        data: {
          status: BulkPriceJobStatus.failed,
          startedAt: job.startedAt ?? new Date(),
          errorMessage:
            error instanceof Error ? error.message : 'Batch processing failed',
        },
      });
      return this.toJobResponse(failed);
    }
  }

  private async summarizeBatch(
    dto: BulkCalculateBuyPricesDto,
    mode: BulkPriceJobMode,
    results: StrategyResult[],
  ): Promise<JobResultSummary[]> {
    if (mode === BulkPriceJobMode.calculate) {
      return results.map((result) => this.toSummary(result));
    }

    const buyPrices = await this.pricesService.persistGeneratedResults(
      dto,
      results,
    );
    const buyPriceIdByIdentity = new Map(
      buyPrices.map((buyPrice) => [
        `${buyPrice.productId}|${buyPrice.productOfferingId ?? ''}|${buyPrice.priceUnitId}`,
        buyPrice.id,
      ]),
    );

    return results.map((result) => {
      const identity = `${result.productId}|${result.productOfferingId ?? ''}|${result.priceUnitId}`;
      return this.toSummary(result, buyPriceIdByIdentity.get(identity));
    });
  }

  private toSummary(
    result: StrategyResult,
    buyPriceId?: string,
  ): JobResultSummary {
    return {
      productId: result.productId,
      productOfferingId: result.productOfferingId ?? null,
      buyPriceId,
      strategyUsed: result.strategyUsed,
      baseMarketPrice: result.baseMarketPrice,
      marginAmount: result.marginAmount,
      logisticsBuffer: result.logisticsBuffer,
      riskBuffer: result.riskBuffer,
      finalPrice: result.finalPrice,
      landedCost: result.landedCost ?? null,
      currency: result.currency,
      priceUnitId: result.priceUnitId,
      priceUnitCode: result.priceUnit.code,
      explanation: result.explanation,
    };
  }

  private async requireJob(jobId: string) {
    const job = await this.prisma.bulkPriceJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Bulk price job not found');
    }

    return job;
  }

  private toJobResponse(job: {
    id: string;
    mode: BulkPriceJobMode;
    status: BulkPriceJobStatus;
    totalTargets: number;
    processedTargets: number;
    results: Prisma.JsonValue;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      jobId: job.id,
      mode: job.mode,
      status: job.status,
      totalTargets: job.totalTargets,
      processedTargets: job.processedTargets,
      done: job.status === BulkPriceJobStatus.completed,
      failed: job.status === BulkPriceJobStatus.failed,
      errorMessage: job.errorMessage ?? undefined,
      results: job.results as unknown as JobResultSummary[],
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt,
    };
  }
}
