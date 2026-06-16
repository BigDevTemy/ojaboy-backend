import {
  PriceAlertCondition,
  PriceAlertFrequency,
  PriceAlertStatus,
  PriceUnit,
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
  const priceAlert = {
    id: 'alert-id',
    userId,
    productId: product.id,
    targetPrice: new Prisma.Decimal(60000),
    currency: 'NGN',
    unit: PriceUnit.bag,
    condition: PriceAlertCondition.at_or_below,
    frequency: PriceAlertFrequency.one_time,
    status: PriceAlertStatus.active,
    lastTriggeredAt: null,
    triggeredPrice: null,
    triggerCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    product,
  };

  it('creates a user-owned price alert for an existing product', async () => {
    const create = jest.fn().mockResolvedValue(priceAlert);
    const service = new PriceAlertsService({
      product: { findUnique: jest.fn().mockResolvedValue({ id: product.id }) },
      priceAlert: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    } as never);

    const result = await service.create(userId, {
      productId: product.id,
      targetPrice: 60000,
      unit: PriceUnit.bag,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          productId: product.id,
          targetPrice: 60000,
          currency: 'NGN',
          unit: PriceUnit.bag,
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
    } as never);

    const result = await service.findAll(userId, {
      status: PriceAlertStatus.active,
      productId: product.id,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          productId: product.id,
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
      priceAlert: {
        findFirst: jest.fn().mockResolvedValue(priceAlert),
        update,
      },
    } as never);

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
    } as never);

    const result = await service.remove(userId, priceAlert.id);

    expect(deleteAlert).toHaveBeenCalledWith({
      where: { id: priceAlert.id },
    });
    expect(result).toEqual({
      message: 'Price alert deleted successfully.',
      deletedPriceAlertId: priceAlert.id,
    });
  });
});
