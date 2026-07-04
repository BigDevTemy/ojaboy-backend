import { NotFoundException } from '@nestjs/common';
import { BulkPriceJobMode, BulkPriceJobStatus } from '@prisma/client';
import { BulkPriceJobsService } from './bulk-price-jobs.service';
import { BulkTarget, PricesService, StrategyResult } from './prices.service';

const dto = { strategy: 'standard_markup' } as never;

const targets: BulkTarget[] = [
  { productId: 'p1', productOfferingId: null, unit: 'bag' },
  { productId: 'p2', productOfferingId: null, unit: 'bag' },
  { productId: 'p3', productOfferingId: null, unit: 'bag' },
  { productId: 'p4', productOfferingId: null, unit: 'bag' },
];

function makeResult(productId: string): StrategyResult {
  return {
    strategyUsed: 'standard_markup' as never,
    productId,
    baseMarketPrice: 100,
    marginAmount: 10,
    logisticsBuffer: 5,
    riskBuffer: 5,
    finalPrice: 120,
    currency: 'NGN',
    priceUnitId: 'unit-id',
    priceUnit: { code: 'bag' } as never,
    consideredMarketPrices: [],
    explanation: 'test',
  };
}

function createJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    mode: BulkPriceJobMode.calculate,
    status: BulkPriceJobStatus.pending,
    strategy: 'standard_markup',
    requestParams: dto,
    targets,
    totalTargets: targets.length,
    processedTargets: 0,
    results: [],
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('BulkPriceJobsService', () => {
  it('creates a job with the resolved targets and pending status', async () => {
    const findBulkTargets = jest.fn().mockResolvedValue(targets);
    const create = jest.fn().mockResolvedValue(createJobRow());
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { create } } as never,
      { findBulkTargets } as never,
    );

    const job = await service.createJob(dto, BulkPriceJobMode.calculate);

    expect(findBulkTargets).toHaveBeenCalledWith(dto);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mode: BulkPriceJobMode.calculate,
        totalTargets: targets.length,
      }),
    });
    expect(job).toMatchObject({
      jobId: 'job-1',
      status: BulkPriceJobStatus.pending,
      totalTargets: 4,
      processedTargets: 0,
      done: false,
      failed: false,
    });
  });

  it('throws NotFoundException when the job does not exist', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique } } as never,
      {} as never,
    );

    await expect(service.getJob('missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('processes one batch, appends results, and stays processing when targets remain', async () => {
    PricesService.BULK_CALCULATION_CONCURRENCY;
    const jobRow = createJobRow();
    const findUnique = jest.fn().mockResolvedValue(jobRow);
    const batchResults = [makeResult('p1'), makeResult('p2'), makeResult('p3')];
    const calculateStrategyBatch = jest.fn().mockResolvedValue(batchResults);
    const update = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...jobRow, ...data }),
    );
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique, update } } as never,
      { calculateStrategyBatch } as never,
    );

    const result = await service.processNextBatch('job-1');

    expect(calculateStrategyBatch).toHaveBeenCalledWith(
      dto,
      targets.slice(0, PricesService.BULK_CALCULATION_CONCURRENCY),
    );
    expect(result.status).toBe(BulkPriceJobStatus.processing);
    expect(result.processedTargets).toBe(3);
    expect(result.done).toBe(false);
    expect(result.results).toHaveLength(3);
  });

  it('marks the job completed once every target has been processed', async () => {
    const jobRow = createJobRow({
      processedTargets: 3,
      results: [makeResult('p1'), makeResult('p2'), makeResult('p3')],
    });
    const findUnique = jest.fn().mockResolvedValue(jobRow);
    const calculateStrategyBatch = jest
      .fn()
      .mockResolvedValue([makeResult('p4')]);
    const update = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...jobRow, ...data }),
    );
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique, update } } as never,
      { calculateStrategyBatch } as never,
    );

    const result = await service.processNextBatch('job-1');

    expect(result.status).toBe(BulkPriceJobStatus.completed);
    expect(result.done).toBe(true);
    expect(result.processedTargets).toBe(4);
    expect(result.results).toHaveLength(4);
  });

  it('persists generated results for generate-mode jobs and attaches buyPriceId', async () => {
    const jobRow = createJobRow({ mode: BulkPriceJobMode.generate });
    const findUnique = jest.fn().mockResolvedValue(jobRow);
    const batchResults = [makeResult('p1')];
    const calculateStrategyBatch = jest.fn().mockResolvedValue(batchResults);
    const persistGeneratedResults = jest.fn().mockResolvedValue([
      { id: 'bp-1', productId: 'p1', productOfferingId: null, priceUnitId: 'unit-id' },
    ]);
    const update = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...jobRow, ...data }),
    );
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique, update } } as never,
      { calculateStrategyBatch, persistGeneratedResults } as never,
    );

    const result = await service.processNextBatch('job-1');

    expect(persistGeneratedResults).toHaveBeenCalledWith(dto, batchResults);
    expect(result.results[0]).toMatchObject({
      productId: 'p1',
      buyPriceId: 'bp-1',
    });
  });

  it('marks the job failed and records the error message when a batch throws', async () => {
    const jobRow = createJobRow();
    const findUnique = jest.fn().mockResolvedValue(jobRow);
    const calculateStrategyBatch = jest
      .fn()
      .mockRejectedValue(new Error('DB connection pool exhausted'));
    const update = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...jobRow, ...data }),
    );
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique, update } } as never,
      { calculateStrategyBatch } as never,
    );

    const result = await service.processNextBatch('job-1');

    expect(result.status).toBe(BulkPriceJobStatus.failed);
    expect(result.failed).toBe(true);
    expect(result.errorMessage).toBe('DB connection pool exhausted');
  });

  it('returns the job as-is without reprocessing once completed', async () => {
    const jobRow = createJobRow({ status: BulkPriceJobStatus.completed });
    const findUnique = jest.fn().mockResolvedValue(jobRow);
    const calculateStrategyBatch = jest.fn();
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique } } as never,
      { calculateStrategyBatch } as never,
    );

    const result = await service.processNextBatch('job-1');

    expect(calculateStrategyBatch).not.toHaveBeenCalled();
    expect(result.status).toBe(BulkPriceJobStatus.completed);
  });

  it('marks a job completed when there are zero targets to process', async () => {
    const jobRow = createJobRow({ targets: [], totalTargets: 0 });
    const findUnique = jest.fn().mockResolvedValue(jobRow);
    const update = jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...jobRow, ...data }),
    );
    const service = new BulkPriceJobsService(
      { bulkPriceJob: { findUnique, update } } as never,
      {} as never,
    );

    const result = await service.processNextBatch('job-1');

    expect(result.status).toBe(BulkPriceJobStatus.completed);
    expect(result.done).toBe(true);
  });
});
