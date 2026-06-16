import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService order authentication', () => {
  const createService = (prisma: Record<string, unknown>) =>
    new OrdersService(
      {} as ConfigService,
      {} as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );

  it('rejects order creation without a JWT user or order token', async () => {
    const prisma = {
      $transaction: jest.fn(
        (callback: (transaction: Record<string, never>) => unknown) =>
          callback({}),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.create({
        items: [
          {
            buyPriceId: '00000000-0000-0000-0000-000000000000',
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('A valid access token or order token is required');
  });

  it('returns user order statistics with zero defaults', async () => {
    const prisma = {
      order: {
        count: jest
          .fn()
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0)
          .mockReturnValueOnce(0),
      },
      payment: {
        aggregate: jest.fn().mockReturnValue({ _sum: { amount: null } }),
      },
      orderFeedback: {
        aggregate: jest.fn().mockReturnValue({ _avg: { rating: null } }),
      },
      $transaction: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
    };
    const service = createService(prisma);

    await expect(service.getUserOrderStats('user-id')).resolves.toEqual({
      totalOrders: 0,
      totalMoneySpent: 0,
      totalCompletedOrders: 0,
      totalPendingOrders: 0,
      averageRating: 0,
    });
    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-id', status: PaymentStatus.successful },
      _sum: { amount: true },
    });
  });

  it('queries current orders using active statuses only', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = createService({ order: { findMany } });

    await service.getCurrentOrders('user-id');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-id',
          status: {
            in: [
              OrderStatus.pending,
              OrderStatus.confirmed,
              OrderStatus.processing,
              OrderStatus.out_for_delivery,
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('paginates user orders with a default limit of 50', async () => {
    const findMany = jest.fn().mockReturnValue([]);
    const count = jest.fn().mockReturnValue(75);
    const prisma = {
      order: { findMany, count },
      $transaction: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
    };
    const service = createService(prisma);

    await expect(service.getUserOrders('user-id', {})).resolves.toEqual({
      orders: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 75,
        totalPages: 2,
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-id' },
        skip: 0,
        take: 50,
      }),
    );
  });

  it('calculates the offset for a requested user-order page', async () => {
    const findMany = jest.fn().mockReturnValue([]);
    const prisma = {
      order: {
        findMany,
        count: jest.fn().mockReturnValue(45),
      },
      $transaction: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
    };
    const service = createService(prisma);

    await service.getUserOrders('user-id', { page: 3, limit: 20 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 40,
        take: 20,
      }),
    );
  });

  it('returns one order belonging to the authenticated user', async () => {
    const order = { id: 'order-id', userId: 'user-id' };
    const findFirst = jest.fn().mockResolvedValue(order);
    const service = createService({ order: { findFirst } });

    await expect(service.getUserOrder('user-id', 'order-id')).resolves.toEqual({
      order,
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-id', userId: 'user-id' },
      }),
    );
  });

  it('does not expose an order missing from the authenticated user', async () => {
    const service = createService({
      order: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(
      service.getUserOrder('user-id', 'foreign-order-id'),
    ).rejects.toThrow('Order not found');
  });

  it('rejects feedback for an order that is not delivered', async () => {
    const service = createService({
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-id',
          status: OrderStatus.processing,
        }),
      },
    });

    await expect(
      service.createFeedback('user-id', 'order-id', { rating: 5 }),
    ).rejects.toThrow('Feedback can only be submitted for a delivered order');
  });

  it('creates one feedback record for the delivered order owner', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'feedback-id',
      orderId: 'order-id',
      userId: 'user-id',
      rating: 5,
      comment: 'Excellent delivery',
    });
    const service = createService({
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-id',
          status: OrderStatus.delivered,
        }),
      },
      orderFeedback: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    });

    await service.createFeedback('user-id', 'order-id', {
      rating: 5,
      comment: ' Excellent delivery ',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-id',
        userId: 'user-id',
        rating: 5,
        comment: 'Excellent delivery',
      },
    });
  });
});
