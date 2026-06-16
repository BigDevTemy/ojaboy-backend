import { ConfigService } from '@nestjs/config';
import {
  NotificationSource,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
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

  it('filters and paginates all orders by order and payment status', async () => {
    const findMany = jest.fn().mockReturnValue([]);
    const count = jest.fn().mockReturnValue(0);
    const prisma = {
      order: { findMany, count },
      $transaction: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
    };
    const service = createService(prisma);

    await expect(
      service.findAll({
        page: 1,
        limit: 50,
        status: OrderStatus.pending,
        paymentStatus: OrderPaymentStatus.pending,
      }),
    ).resolves.toEqual({
      data: [],
      pagination: {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 0,
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: OrderStatus.pending,
          paymentStatus: OrderPaymentStatus.pending,
          userId: undefined,
          createdAt: undefined,
        },
        skip: 0,
        take: 50,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        status: OrderStatus.pending,
        paymentStatus: OrderPaymentStatus.pending,
        userId: undefined,
        createdAt: undefined,
      },
    });
  });

  it('treats date-only order list ranges as full UTC days', async () => {
    const findMany = jest.fn().mockReturnValue([]);
    const count = jest.fn().mockReturnValue(0);
    const prisma = {
      order: { findMany, count },
      $transaction: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
    };
    const service = createService(prisma);

    await service.findAll({
      page: 1,
      limit: 50,
      from: '2026-06-15',
      to: '2026-06-15',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-06-15T00:00:00.000Z'),
            lte: new Date('2026-06-15T23:59:59.999Z'),
          },
        }),
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

  it('returns an order by id for the authenticated owner', async () => {
    const order = { id: 'order-id', userId: 'user-id' };
    const findFirst = jest.fn().mockResolvedValue(order);
    const service = createService({ order: { findFirst } });

    await expect(
      service.findOneForUser(
        {
          id: 'user-id',
          email: 'customer@example.com',
          fullName: 'Customer',
          role: 'user',
          authProviders: ['password'],
          emailVerified: true,
        },
        'order-id',
      ),
    ).resolves.toEqual({ order });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-id', userId: 'user-id' },
      }),
    );
  });

  it('allows admins to fetch an order by id without ownership filtering', async () => {
    const order = { id: 'order-id', userId: 'user-id' };
    const findFirst = jest.fn().mockResolvedValue(order);
    const service = createService({ order: { findFirst } });

    await expect(
      service.findOneForUser(
        {
          id: 'admin-id',
          email: 'admin@example.com',
          fullName: 'Admin',
          role: 'admin',
          authProviders: ['password'],
          emailVerified: true,
        },
        'order-id',
      ),
    ).resolves.toEqual({ order });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-id', userId: undefined },
      }),
    );
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

  it('updates an order status and creates an order notification', async () => {
    const existingOrder = {
      id: 'order-id',
      userId: 'user-id',
      status: OrderStatus.confirmed,
      paymentStatus: 'pending',
      total: 5000,
    };
    const updatedOrder = {
      ...existingOrder,
      status: OrderStatus.processing,
    };
    const update = jest.fn().mockResolvedValue(updatedOrder);
    const createNotification = jest.fn().mockResolvedValue({
      id: 'notification-id',
    });
    const service = new OrdersService(
      {} as ConfigService,
      {} as never,
      {
        order: {
          findUnique: jest.fn().mockResolvedValue(existingOrder),
          update,
        },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { createNotification } as never,
    );

    const result = await service.updateStatus(
      {
        id: 'admin-id',
        email: 'admin@example.com',
        fullName: 'Admin',
        role: 'admin',
        authProviders: ['password'],
        emailVerified: true,
      },
      'order-id',
      { status: OrderStatus.processing },
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-id' },
        data: { status: OrderStatus.processing },
      }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        source: NotificationSource.order,
        event: 'order_status_changed',
        orderId: 'order-id',
        metadata: {
          orderId: 'order-id',
          oldStatus: OrderStatus.confirmed,
          newStatus: OrderStatus.processing,
        },
      }),
      { actorUserId: 'admin-id', source: NotificationSource.order },
    );
    expect(result.message).toBe('Order status updated successfully.');
  });
});
