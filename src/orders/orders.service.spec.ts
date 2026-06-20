import { ConfigService } from '@nestjs/config';
import {
  NotificationSource,
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';
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

  it('exports filtered orders as one spreadsheet row per order item', async () => {
    const order = {
      id: 'order-id',
      userId: 'user-id',
      status: OrderStatus.pending,
      paymentStatus: OrderPaymentStatus.pending,
      subtotal: 72000,
      discountAmount: 0,
      serviceFee: 1000,
      deliveryFee: 2000,
      total: 75000,
      deliveryAddress: '12 Herbert Macaulay Way',
      note: 'Call before delivery',
      createdAt: new Date('2026-06-15T10:00:00.000Z'),
      user: {
        fullName: 'Customer',
        email: 'customer@example.com',
      },
      deliveryZone: { name: 'Yaba' },
      payments: [
        {
          id: 'payment-id',
          status: PaymentStatus.pending,
          provider: 'paystack',
          providerReference: 'order_order-id',
          createdAt: new Date('2026-06-15T10:01:00.000Z'),
        },
      ],
      items: [
        {
          id: 'item-id',
          productId: 'product-id',
          product: { name: 'Local Rice' },
          quantity: 1,
          unit: 'bag',
          unitPrice: 72000,
          totalPrice: 72000,
          buyPriceId: 'buy-price-id',
        },
      ],
    };
    const findMany = jest.fn().mockResolvedValue([order]);
    const service = createService({ order: { findMany } });

    const result = await service.exportOrders(
      {
        id: 'admin-id',
        email: 'admin@example.com',
        fullName: 'Admin',
        role: 'admin',
        authProviders: ['password'],
        emailVerified: true,
      },
      {
        page: 1,
        limit: 50,
        status: OrderStatus.pending,
        paymentStatus: OrderPaymentStatus.pending,
        from: '2026-06-15',
        to: '2026-06-15',
        format: 'xlsx',
      },
    );
    const workbook = XLSX.read(result.buffer, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['Order Items'],
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: OrderStatus.pending,
          paymentStatus: OrderPaymentStatus.pending,
        }),
      }),
    );
    expect(result.filename).toMatch(/^orders-export-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        orderId: 'order-id',
        productName: 'Local Rice',
        quantity: 1,
        unit: 'bag',
        itemTotal: 72000,
      }),
    );
  });

  it('exports order item rows as csv', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'order-id',
        userId: 'user-id',
        status: OrderStatus.pending,
        paymentStatus: OrderPaymentStatus.pending,
        subtotal: 100,
        discountAmount: 0,
        serviceFee: 0,
        deliveryFee: 0,
        total: 100,
        deliveryAddress: 'Address',
        note: null,
        createdAt: new Date('2026-06-15T10:00:00.000Z'),
        user: { fullName: 'Customer', email: 'customer@example.com' },
        deliveryZone: null,
        payments: [],
        items: [
          {
            id: 'item-id',
            productId: 'product-id',
            product: { name: 'Beans' },
            quantity: 1,
            unit: 'bag',
            unitPrice: 100,
            totalPrice: 100,
            buyPriceId: null,
          },
        ],
      },
    ]);
    const service = createService({ order: { findMany } });

    const result = await service.exportOrders(
      {
        id: 'admin-id',
        email: 'admin@example.com',
        fullName: 'Admin',
        role: 'admin',
        authProviders: ['password'],
        emailVerified: true,
      },
      { page: 1, limit: 50, format: 'csv' },
    );

    expect(result.contentType).toBe('text/csv; charset=utf-8');
    expect(result.buffer.toString()).toContain('orderId,orderDate');
    expect(result.buffer.toString()).toContain('order-id');
    expect(result.buffer.toString()).toContain('Beans');
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
      user: {
        id: 'user-id',
        email: 'customer@example.com',
        fullName: 'Customer',
      },
      items: [
        {
          product: { name: 'Tomatoes' },
          buyPrice: { currency: 'NGN' },
          quantity: 2,
          unit: 'kg',
          unitPrice: 1000,
          totalPrice: 2000,
        },
      ],
      subtotal: 2000,
      discountAmount: 0,
      serviceFee: 100,
      deliveryFee: 500,
      note: null,
    };
    const update = jest.fn().mockResolvedValue(updatedOrder);
    const sendTemplateEmail = jest.fn().mockResolvedValue(undefined);
    const createNotification = jest.fn().mockResolvedValue({
      id: 'notification-id',
    });
    const service = new OrdersService(
      {} as ConfigService,
      { sendTemplateEmail } as never,
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
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        template: 'order-status',
        variables: expect.objectContaining({
          orderNumber: 'order-id',
          orderStatus: OrderStatus.processing,
          orderMessage: 'Your order status has been updated to Processing.',
        }),
      }),
    );
    expect(result.message).toBe('Order status updated successfully.');
  });

  it('bulk updates order statuses and reports unchanged and missing orders', async () => {
    const existingOrders = [
      {
        id: 'order-one',
        userId: 'user-one',
        status: OrderStatus.confirmed,
        paymentStatus: 'pending',
        total: 5000,
      },
      {
        id: 'order-two',
        userId: 'user-two',
        status: OrderStatus.processing,
        paymentStatus: 'pending',
        total: 3500,
      },
    ];
    const updatedOrder = {
      ...existingOrders[0],
      status: OrderStatus.processing,
      user: {
        id: 'user-one',
        email: 'customer@example.com',
        fullName: 'Customer',
      },
      items: [
        {
          product: { name: 'Tomatoes' },
          buyPrice: { currency: 'NGN' },
          quantity: 2,
          unit: 'kg',
          unitPrice: 1000,
          totalPrice: 2000,
        },
      ],
      subtotal: 2000,
      discountAmount: 0,
      serviceFee: 100,
      deliveryFee: 500,
      note: null,
    };
    const update = jest.fn().mockResolvedValue(updatedOrder);
    const sendTemplateEmail = jest.fn().mockResolvedValue(undefined);
    const createNotification = jest.fn().mockResolvedValue({
      id: 'notification-id',
    });
    const prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue(existingOrders),
        update,
      },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const service = new OrdersService(
      {} as ConfigService,
      { sendTemplateEmail } as never,
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      { createNotification } as never,
    );

    const result = await service.bulkUpdateStatus(
      {
        id: 'admin-id',
        email: 'admin@example.com',
        fullName: 'Admin',
        role: 'admin',
        authProviders: ['password'],
        emailVerified: true,
      },
      {
        orderIds: ['order-one', 'order-two', 'missing-order'],
        status: OrderStatus.processing,
      },
    );

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['order-one', 'order-two', 'missing-order'] },
        },
      }),
    );
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-one' },
        data: { status: OrderStatus.processing },
      }),
    );
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-one',
        event: 'order_status_changed',
        orderId: 'order-one',
        metadata: {
          orderId: 'order-one',
          oldStatus: OrderStatus.confirmed,
          newStatus: OrderStatus.processing,
        },
      }),
      { actorUserId: 'admin-id', source: NotificationSource.order },
    );
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        template: 'order-status',
        variables: expect.objectContaining({
          orderNumber: 'order-one',
          orderStatus: OrderStatus.processing,
          orderMessage: 'Your order status has been updated to Processing.',
        }),
      }),
    );
    expect(result).toMatchObject({
      message: 'Bulk order status update completed.',
      status: OrderStatus.processing,
      summary: {
        requested: 3,
        updated: 1,
        unchanged: 1,
        notFound: 1,
      },
      updatedOrderIds: ['order-one'],
      unchangedOrderIds: ['order-two'],
      notFoundOrderIds: ['missing-order'],
    });
  });
});
