import {
  BuyPriceStrategy,
  PriceQualityGrade,
  PriceSource,
  Prisma,
} from '@prisma/client';
import { PricesService } from './prices.service';

describe('PricesService offering isolation', () => {
  const productId = '11111111-1111-4111-8111-111111111111';
  const offeringId = '22222222-2222-4222-8222-222222222222';
  const priceUnit = {
    id: 'unit-id',
    code: 'bag',
    label: 'Bag',
    aliases: ['bags'],
    packageType: 'bag',
    sortOrder: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const priceUnitsService = {
    requireByCode: jest.fn().mockResolvedValue(priceUnit),
    getLookup: jest.fn().mockResolvedValue({
      resolveFromPackage: jest.fn().mockReturnValue(priceUnit),
    }),
  };

  function marketPrice(id: string, amount: number, exactOffering = true) {
    return {
      id,
      productId,
      productOfferingId: exactOffering ? offeringId : null,
      marketId: `${id}-market`,
      amount: new Prisma.Decimal(amount),
      currency: 'NGN',
      priceUnitId: priceUnit.id,
      priceUnit,
      quantity: new Prisma.Decimal(1),
      qualityGrade: PriceQualityGrade.standard,
      source: PriceSource.manual,
      observedAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      market: {
        id: `${id}-market`,
        marketname: `${id} market`,
        marketaddress: null,
      },
      product: { id: productId, name: 'Rice', sku: 'RICE' },
      productOffering: exactOffering
        ? {
            id: offeringId,
            sku: 'RICE-SPECIAL-50KG',
            variant: {
              id: 'variant-id',
              name: 'Special Rice',
              code: 'SPECIAL',
            },
            brand: { id: 'brand-id', name: 'My Choice' },
            package: { id: 'package-id', name: '50 kg bag' },
          }
        : null,
    };
  }

  it('calculates an aggregate using only the requested offering', async () => {
    const findMarketPrices = jest
      .fn()
      .mockResolvedValue([
        marketPrice('price-one', 70000),
        marketPrice('price-two', 80000),
      ]);
    const service = new PricesService(
      {
        productOffering: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: offeringId, productId }),
        },
        marketPrice: { findMany: findMarketPrices },
      } as never,
      priceUnitsService as never,
    );

    const response = await service.calculate({
      productId,
      productOfferingId: offeringId,
      unit: 'bag',
      strategy: BuyPriceStrategy.average,
    });

    expect(findMarketPrices).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId,
          productOfferingId: offeringId,
          priceUnitId: priceUnit.id,
        }),
      }),
    );
    expect(response.result).toEqual(
      expect.objectContaining({
        productOfferingId: offeringId,
        baseMarketPrice: 75000,
      }),
    );
  });

  it('rejects calculations without an exact offering', async () => {
    const service = new PricesService(
      {} as never,
      priceUnitsService as never,
    );

    await expect(
      service.calculate({
        productId,
        unit: 'bag',
        strategy: BuyPriceStrategy.cheapest,
      } as never),
    ).rejects.toThrow(
      'productOfferingId is required for new buy-price writes and calculations',
    );
  });

  it('rejects an offering that belongs to another product', async () => {
    const service = new PricesService(
      {
        productOffering: {
          findUnique: jest.fn().mockResolvedValue({
            id: offeringId,
            productId: '33333333-3333-4333-8333-333333333333',
          }),
        },
      } as never,
      priceUnitsService as never,
    );

    await expect(
      service.calculate({
        productId,
        productOfferingId: offeringId,
        unit: 'bag',
        strategy: BuyPriceStrategy.manual_override,
        manualFinalPrice: 75000,
      }),
    ).rejects.toThrow(
      'Product offering does not belong to the selected product',
    );
  });

  it('keeps separate offerings as separate bulk calculation targets', async () => {
    const secondOfferingId = '44444444-4444-4444-8444-444444444444';
    const findMarketPrices = jest.fn(
      (args: {
        distinct?: string[];
        where?: { productOfferingId?: unknown };
      }) => {
        if (args.distinct?.[0] === 'productOfferingId') {
          return Promise.resolve([
            {
              productId,
              productOfferingId: offeringId,
              priceUnit: { code: 'bag' },
            },
            {
              productId,
              productOfferingId: secondOfferingId,
              priceUnit: { code: 'bag' },
            },
          ]);
        }
        const requestedOfferingId = args.where?.productOfferingId;
        return Promise.resolve([
          {
            ...marketPrice(
              `price-${String(requestedOfferingId)}`,
              requestedOfferingId === offeringId ? 70000 : 85000,
            ),
            productOfferingId: requestedOfferingId,
            productOffering: {
              id: requestedOfferingId,
              sku: `SKU-${String(requestedOfferingId)}`,
              variant: null,
              brand: null,
              package: { id: 'package-id', name: '50 kg bag' },
            },
          },
        ]);
      },
    );
    const service = new PricesService(
      {
        productOffering: {
          findUnique: jest.fn(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id, productId }),
          ),
        },
        marketPrice: { findMany: findMarketPrices },
      } as never,
      priceUnitsService as never,
    );

    const response = await service.calculateBulk({
      strategy: BuyPriceStrategy.cheapest,
      unit: 'bag',
    });

    expect(response.count).toBe(2);
    expect(response.results.map((result) => result.productOfferingId)).toEqual(
      expect.arrayContaining([offeringId, secondOfferingId]),
    );
    expect(findMarketPrices).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: ['productOfferingId'],
      }),
    );
  });

  it('deactivates only the same offering when creating an active price', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({ id: 'buy-price-id' });
    const transaction = jest.fn(
      async (
        callback: (tx: {
          buyPrice: { updateMany: typeof updateMany; create: typeof create };
        }) => Promise<unknown>,
      ) => callback({ buyPrice: { updateMany, create } }),
    );
    const service = new PricesService(
      {
        productOffering: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: offeringId, productId }),
        },
        $transaction: transaction,
      } as never,
      priceUnitsService as never,
    );

    await service.create({
      productId,
      productOfferingId: offeringId,
      baseMarketPrice: 70000,
      unit: 'bag',
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { productOfferingId: offeringId, isActive: true },
      data: { isActive: false },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productOfferingId: offeringId }),
      }),
    );
  });
});
