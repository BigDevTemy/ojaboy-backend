import { MarketPricesService } from './market-prices.service';

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
};

describe('MarketPricesService exact offering writes', () => {
  it('rejects a new market price without productOfferingId', async () => {
    const service = new MarketPricesService(
      {} as never,
      {} as never,
      priceUnitsService as never,
    );

    await expect(
      service.create({
        productId: '11111111-1111-4111-8111-111111111111',
        marketId: '22222222-2222-4222-8222-222222222222',
        amount: 70000,
        unit: 'bag',
        observedAt: '2026-06-24T08:00:00.000Z',
      } as never),
    ).rejects.toThrow('productOfferingId is required for new market prices');
  });

  it('creates an exact offering market price and evaluates its alerts', async () => {
    const productId = '11111111-1111-4111-8111-111111111111';
    const productOfferingId = '22222222-2222-4222-8222-222222222222';
    const marketPrice = {
      id: 'market-price-id',
      productId,
      productOfferingId,
    };
    const create = jest.fn().mockResolvedValue(marketPrice);
    const evaluateMarketPrice = jest.fn().mockResolvedValue({
      evaluated: 0,
      triggered: 0,
    });
    const service = new MarketPricesService(
      {
        productOffering: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: productOfferingId, productId }),
        },
        marketPrice: { create },
      } as never,
      { evaluateMarketPrice } as never,
      priceUnitsService as never,
    );

    await service.create({
      productId,
      productOfferingId,
      marketId: '33333333-3333-4333-8333-333333333333',
      amount: 70000,
      unit: 'bag',
      observedAt: '2026-06-24T08:00:00.000Z',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productOfferingId }),
      }),
    );
    expect(evaluateMarketPrice).toHaveBeenCalledWith(marketPrice);
  });
});
