import {
  MarketAnalysisSnapshotStatus,
  MarketAnalysisTrend,
  Prisma,
} from '@prisma/client';
import { MarketAnalysisService } from './market-analysis.service';

describe('MarketAnalysisService', () => {
  const analysisDate = new Date('2026-06-24T00:00:00.000Z');
  const offeringId = '22222222-2222-4222-8222-222222222222';

  it('returns a valid empty response before the first completed snapshot', async () => {
    const service = new MarketAnalysisService({
      marketAnalysisSnapshot: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as never);

    await expect(service.latest()).resolves.toEqual({
      snapshot: null,
      items: [],
      message: 'No completed analysis yet.',
    });
  });

  it('returns an already completed daily snapshot without recalculating', async () => {
    const snapshot = {
      id: 'snapshot-id',
      analysisDate,
      status: MarketAnalysisSnapshotStatus.completed,
    };
    const findBenchmarks = jest.fn();
    const service = new MarketAnalysisService({
      marketAnalysisSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
      },
      marketAnalysisBenchmark: { findMany: findBenchmarks },
    } as never);

    const result = await service.runDaily('2026-06-24');

    expect(result).toEqual({
      message: 'Analysis already completed for this date.',
      snapshot,
    });
    expect(findBenchmarks).not.toHaveBeenCalled();
  });

  it('uses the latest observation per market and compares its median', async () => {
    const processingSnapshot = {
      id: 'snapshot-id',
      analysisDate,
      status: MarketAnalysisSnapshotStatus.processing,
    };
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const completedSnapshot = {
      ...processingSnapshot,
      status: MarketAnalysisSnapshotStatus.completed,
      items: [],
    };
    const service = new MarketAnalysisService({
      marketAnalysisSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(processingSnapshot),
        findFirst: jest.fn().mockResolvedValue({
          id: 'previous-snapshot',
          items: [
            {
              productOfferingId: offeringId,
              currentPrice: new Prisma.Decimal(70000),
            },
          ],
        }),
      },
      marketAnalysisBenchmark: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'benchmark-id',
            productOfferingId: offeringId,
            currency: 'NGN',
            productOffering: {
              id: offeringId,
              productId: 'product-id',
              product: { name: 'Rice' },
              variant: { name: 'Special Rice' },
              brand: { name: 'My Choice' },
              package: { name: '50 kg bag' },
            },
            markets: [{ marketId: 'market-one' }, { marketId: 'market-two' }],
          },
        ]),
      },
      marketPrice: {
        findMany: jest.fn().mockResolvedValue([
          {
            marketId: 'market-one',
            amount: new Prisma.Decimal(80000),
            observedAt: new Date('2026-06-24T18:00:00.000Z'),
          },
          {
            marketId: 'market-one',
            amount: new Prisma.Decimal(60000),
            observedAt: new Date('2026-06-24T10:00:00.000Z'),
          },
          {
            marketId: 'market-two',
            amount: new Prisma.Decimal(70000),
            observedAt: new Date('2026-06-24T17:00:00.000Z'),
          },
        ]),
      },
      $transaction: jest.fn(
        async (
          callback: (tx: {
            marketAnalysisSnapshotItem: {
              deleteMany: jest.Mock;
              createMany: typeof createMany;
            };
            marketAnalysisSnapshot: { update: jest.Mock };
          }) => Promise<unknown>,
        ) =>
          callback({
            marketAnalysisSnapshotItem: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              createMany,
            },
            marketAnalysisSnapshot: {
              update: jest.fn().mockResolvedValue(completedSnapshot),
            },
          }),
      ),
    } as never);

    await service.runDaily('2026-06-24');

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          snapshotId: 'snapshot-id',
          productOfferingId: offeringId,
          currentPrice: 75000,
          previousPrice: 70000,
          changePercentage: 7.14,
          trend: MarketAnalysisTrend.up,
          observationCount: 2,
          lastPriceAt: new Date('2026-06-24T18:00:00.000Z'),
        }),
      ],
    });
  });
});
