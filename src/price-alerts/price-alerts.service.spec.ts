import {
  PriceAlertCondition,
  PriceAlertFrequency,
  PriceAlertStatus,
  Prisma,
} from '@prisma/client';
import { PriceAlertsService } from './price-alerts.service';

describe('PriceAlertsService', () => {
  const userId = 'user-id';
  const product = {
    id: 'product-id',
    name: 'Rice',
    sku: 'PROD-GRA-RICE',
    category: 'Grains',
    imageUrl: null,
    status: 'active',
  };
  const offering = {
    id: '22222222-2222-4222-8222-222222222222',
    productId: product.id,
    sku: 'RICE-MYCHOICE-SPECIAL-50KG',
    isActive: true,
    variant: { id: 'variant-id', name: 'Special Rice' },
    brand: { id: 'brand-id', name: 'My Choice', manufacturer: null },
    package: { id: 'package-id', name: '50 kg bag' },
  };
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
  const priceAlert = {
    id: 'alert-id',
    userId,
    productId: product.id,
    productOfferingId: offering.id,
    targetPrice: new Prisma.Decimal(60000),
    currency: 'NGN',
    priceUnitId: priceUnit.id,
    condition: PriceAlertCondition.at_or_below,
    frequency: PriceAlertFrequency.one_time,
    status: PriceAlertStatus.active,
    lastTriggeredAt: null,
    triggeredPrice: null,
    triggerCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    product,
    productOffering: offering,
    priceUnit,
  };
  const priceUnitsService = {
    requireByCode: jest.fn().mockResolvedValue(priceUnit),
  };

  it('creates a user-owned price alert for an exact offering', async () => {
    const create = jest.fn().mockResolvedValue(priceAlert);
    const service = new PriceAlertsService(
      {
        productOffering: {
          findUnique: jest.fn().mockResolvedValue({
            id: offering.id,
            productId: product.id,
            isActive: true,
          }),
        },
        priceAlert: {
          findFirst: jest.fn().mockResolvedValue(null),
          create,
        },
      } as never,
      priceUnitsService as never,
    );

    const result = await service.create(userId, {
      productId: product.id,
      productOfferingId: offering.id,
      targetPrice: 60000,
      unit: 'bag',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          productId: product.id,
          productOfferingId: offering.id,
          targetPrice: 60000,
          currency: 'NGN',
          priceUnitId: priceUnit.id,
          frequency: undefined,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        message: 'Price alert created successfully.',
        priceAlert,
      }),
    );
  });

  it('lists alerts scoped to the authenticated user', async () => {
    const findMany = jest.fn().mockResolvedValue([priceAlert]);
    const service = new PriceAlertsService({
      priceAlert: { findMany },
    } as never, priceUnitsService as never);

    const result = await service.findAll(userId, {
      status: PriceAlertStatus.active,
      productId: product.id,
      productOfferingId: offering.id,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          productId: product.id,
          productOfferingId: offering.id,
          status: PriceAlertStatus.active,
        },
      }),
    );
    expect(result).toEqual({ data: [priceAlert] });
  });

  it('updates an owned price alert', async () => {
    const update = jest.fn().mockResolvedValue({
      ...priceAlert,
      status: PriceAlertStatus.paused,
    });
    const service = new PriceAlertsService({
      productOffering: {
        findUnique: jest.fn().mockResolvedValue({
          id: offering.id,
          productId: product.id,
          isActive: true,
        }),
      },
      priceAlert: {
        findFirst: jest.fn().mockResolvedValue(priceAlert),
        update,
      },
    } as never, priceUnitsService as never);

    const result = await service.update(userId, priceAlert.id, {
      status: PriceAlertStatus.paused,
      frequency: PriceAlertFrequency.once_per_day,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: priceAlert.id },
        data: expect.objectContaining({
          status: PriceAlertStatus.paused,
          frequency: PriceAlertFrequency.once_per_day,
        }),
      }),
    );
    expect(result.priceAlert.status).toBe(PriceAlertStatus.paused);
  });

  it('deletes an owned price alert', async () => {
    const deleteAlert = jest.fn().mockResolvedValue(priceAlert);
    const service = new PriceAlertsService({
      priceAlert: {
        findFirst: jest.fn().mockResolvedValue(priceAlert),
        delete: deleteAlert,
      },
    } as never, priceUnitsService as never);

    const result = await service.remove(userId, priceAlert.id);

    expect(deleteAlert).toHaveBeenCalledWith({
      where: { id: priceAlert.id },
    });
    expect(result).toEqual({
      message: 'Price alert deleted successfully.',
      deletedPriceAlertId: priceAlert.id,
    });
  });

  it('rejects an offering that belongs to another product', async () => {
    const service = new PriceAlertsService({
      productOffering: {
        findUnique: jest.fn().mockResolvedValue({
          id: offering.id,
          productId: 'different-product',
          isActive: true,
        }),
      },
    } as never, priceUnitsService as never);

    await expect(
      service.create(userId, {
        productId: product.id,
        productOfferingId: offering.id,
        targetPrice: 60000,
        unit: 'bag',
      }),
    ).rejects.toThrow(
      'Product offering does not belong to the selected product',
    );
  });

  it('triggers only alerts for the observed product offering', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createNotification = jest.fn().mockResolvedValue({
      id: 'notification-id',
    });
    const service = new PriceAlertsService({
      priceAlert: {
        findMany: jest.fn().mockResolvedValue([priceAlert]),
        updateMany,
      },
      notification: { create: createNotification },
    } as never, priceUnitsService as never);
    const observedAt = new Date('2026-06-24T08:00:00.000Z');

    const result = await service.evaluateMarketPrice({
      id: 'market-price-id',
      productId: product.id,
      productOfferingId: offering.id,
      marketId: 'market-id',
      amount: new Prisma.Decimal(59000),
      currency: 'NGN',
      priceUnitId: priceUnit.id,
      quantity: new Prisma.Decimal(1),
      qualityGrade: 'standard',
      source: 'manual',
      observedAt,
      notes: null,
      createdAt: observedAt,
      updatedAt: observedAt,
    });

    expect(result).toEqual({ evaluated: 1, triggered: 1 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: priceAlert.id,
          status: PriceAlertStatus.active,
        }),
        data: expect.objectContaining({
          lastTriggeredAt: observedAt,
          triggeredPrice: new Prisma.Decimal(59000),
          status: PriceAlertStatus.triggered,
        }),
      }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          priceAlertId: priceAlert.id,
          event: 'price_alert_triggered',
        }),
      }),
    );
  });

  it('does not evaluate legacy market prices without an offering', async () => {
    const findMany = jest.fn();
    const service = new PriceAlertsService({
      priceAlert: { findMany },
    } as never, priceUnitsService as never);

    const result = await service.evaluateMarketPrice({
      id: 'legacy-market-price',
      productId: product.id,
      productOfferingId: null,
      marketId: 'market-id',
      amount: new Prisma.Decimal(59000),
      currency: 'NGN',
      priceUnitId: priceUnit.id,
      quantity: new Prisma.Decimal(1),
      qualityGrade: 'standard',
      source: 'manual',
      observedAt: new Date(),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result).toEqual({ evaluated: 0, triggered: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });
});
