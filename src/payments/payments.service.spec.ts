import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderPaymentStatus, PaymentStatus } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const secretKey = 'sk_test_example';
  const configService = {
    get: jest.fn().mockReturnValue(secretKey),
  } as unknown as ConfigService;
  const emailService = {
    sendTemplateEmail: jest.fn().mockResolvedValue(undefined),
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    emailService.sendTemplateEmail.mockClear();
  });

  it('adds a bank transfer expiry exactly 15 minutes ahead', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T12:00:00.000Z'));

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const service = new PaymentsService(
      {} as never,
      configService,
      emailService as never,
    );

    await service.charge({
      email: 'Customer@Example.com',
      amount: 5_000_000,
      currency: 'ngn',
      reference: 'order_abc123',
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(request.body as string) as {
      bank_transfer: { account_expires_at: string };
    };

    expect(body.bank_transfer.account_expires_at).toBe(
      '2026-06-11T12:15:00.000Z',
    );
  });

  it('returns saved Paystack bank transfer accounts with order payments', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new PaymentsService(
      { payment: { findMany } } as never,
      configService,
      emailService as never,
    );

    await expect(service.findByOrder('order-id')).resolves.toEqual({
      data: [],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { orderId: 'order-id' },
      include: {
        user: true,
        paystackBankTransferAccounts: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('keeps an uncertain charge attempt initializing', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'));
    const paymentUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-id',
          providerReference: 'order_abc123',
          amount: { toNumber: () => 50_000 },
          currency: 'NGN',
          order: { paymentStatus: OrderPaymentStatus.pending },
          user: {
            email: 'customer@example.com',
            fullName: 'Test Customer',
          },
        }),
        update: paymentUpdate,
      },
    };
    const service = new PaymentsService(
      prisma as never,
      configService,
      emailService as never,
    );

    await expect(
      service.initializePaymentAttempt('payment-id'),
    ).resolves.toEqual({
      reference: 'order_abc123',
      status: PaymentStatus.initializing,
      paymentAction: 'retry',
      retryAfterSeconds: 10,
      message:
        'Payment initialization is being confirmed. Retry after 10 seconds.',
    });
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-id' },
      data: { status: PaymentStatus.initializing },
    });
  });

  it('asks a retry caller to wait during the reconciliation window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T12:00:05.000Z'));
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-id',
          userId: 'user-id',
          total: { toNumber: () => 50_000 },
          paymentStatus: OrderPaymentStatus.pending,
          user: {
            email: 'customer@example.com',
            fullName: 'Test Customer',
          },
          payments: [
            {
              providerReference: 'order_order-id',
              status: PaymentStatus.initializing,
              updatedAt: new Date('2026-06-11T12:00:00.000Z'),
            },
          ],
        }),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      configService,
      emailService as never,
    );

    await expect(
      service.retryOrderPayment('order-id', 'customer@example.com'),
    ).resolves.toEqual({
      reference: 'order_order-id',
      status: PaymentStatus.initializing,
      paymentAction: 'wait',
      retryAfterSeconds: 5,
      message: 'Wait before checking this payment again.',
    });
  });

  it('returns an existing Paystack transfer after reconciliation', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T12:00:20.000Z'));
    const charge = {
      status: true,
      data: {
        status: 'pay_offline',
        reference: 'order_order-id',
        account_number: '1234567890',
      },
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(charge), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const paymentUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-id',
          userId: 'user-id',
          total: { toNumber: () => 50_000 },
          paymentStatus: OrderPaymentStatus.pending,
          user: {
            email: 'customer@example.com',
            fullName: 'Test Customer',
          },
          payments: [
            {
              id: 'payment-id',
              orderId: 'order-id',
              userId: 'user-id',
              providerReference: 'order_order-id',
              amount: { toNumber: () => 50_000 },
              currency: 'NGN',
              status: PaymentStatus.initializing,
              updatedAt: new Date('2026-06-11T12:00:00.000Z'),
            },
          ],
        }),
      },
      payment: { update: paymentUpdate },
      paystackBankTransferAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      configService,
      emailService as never,
    );

    await expect(
      service.retryOrderPayment('order-id', 'customer@example.com'),
    ).resolves.toEqual({
      reference: 'order_order-id',
      status: PaymentStatus.pending,
      paymentAction: 'none',
      charge,
    });
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-id' },
      data: { status: PaymentStatus.pending },
    });
    expect(prisma.paystackBankTransferAccount.upsert).toHaveBeenCalledWith({
      where: {
        paymentId_accountNumber: {
          paymentId: 'payment-id',
          accountNumber: '1234567890',
        },
      },
      update: expect.objectContaining({
        providerReference: 'order_order-id',
        currency: 'NGN',
        status: PaymentStatus.pending,
      }),
      create: expect.objectContaining({
        orderId: 'order-id',
        paymentId: 'payment-id',
        userId: 'user-id',
        providerReference: 'order_order-id',
        accountNumber: '1234567890',
        currency: 'NGN',
        status: PaymentStatus.pending,
      }),
    });
    expect(emailService.sendTemplateEmail).toHaveBeenCalledWith({
      to: 'customer@example.com',
      template: 'paystack-bank-transfer',
      variables: expect.objectContaining({
        fullName: 'Test Customer',
        orderNumber: 'order-id',
        accountNumber: '1234567890',
        amount: expect.stringContaining('50,000.00'),
      }),
    });
  });

  it('does not fail payment initialization when bank transfer email fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T12:00:20.000Z'));
    const charge = {
      status: true,
      data: {
        status: 'pay_offline',
        reference: 'order_order-id',
        account_number: '1234567890',
      },
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(charge), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const failingEmailService = {
      sendTemplateEmail: jest.fn().mockRejectedValue(new Error('SMTP failed')),
    };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-id',
          userId: 'user-id',
          total: { toNumber: () => 50_000 },
          paymentStatus: OrderPaymentStatus.pending,
          user: {
            email: 'customer@example.com',
            fullName: 'Test Customer',
          },
          payments: [
            {
              id: 'payment-id',
              orderId: 'order-id',
              userId: 'user-id',
              providerReference: 'order_order-id',
              amount: { toNumber: () => 50_000 },
              currency: 'NGN',
              status: PaymentStatus.initializing,
              updatedAt: new Date('2026-06-11T12:00:00.000Z'),
            },
          ],
        }),
      },
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      paystackBankTransferAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new PaymentsService(
      prisma as never,
      configService,
      failingEmailService as never,
    );

    await expect(
      service.retryOrderPayment('order-id', 'customer@example.com'),
    ).resolves.toEqual({
      reference: 'order_order-id',
      status: PaymentStatus.pending,
      paymentAction: 'none',
      charge,
    });
    expect(failingEmailService.sendTemplateEmail).toHaveBeenCalled();
  });

  it('creates retry attempts using an advisory lock query that returns a scalar', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ locked: 1 }]);
    const tx = {
      $queryRaw: queryRaw,
      payment: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({
          id: 'retry-payment-id',
          orderId: 'order-id',
          userId: 'user-id',
          providerReference: 'order_order-id_attempt_2',
          amount: { toNumber: () => 50_000 },
          currency: 'NGN',
          status: PaymentStatus.initializing,
        }),
      },
    };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-id',
          userId: 'user-id',
          total: { toNumber: () => 50_000 },
          paymentStatus: OrderPaymentStatus.pending,
          user: {
            email: 'customer@example.com',
            fullName: 'Test Customer',
          },
          payments: [
            {
              currency: 'NGN',
              status: PaymentStatus.failed,
              updatedAt: new Date('2026-06-11T12:00:00.000Z'),
            },
          ],
        }),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'retry-payment-id',
          providerReference: 'order_order-id_attempt_2',
          amount: { toNumber: () => 50_000 },
          currency: 'NGN',
          order: { paymentStatus: OrderPaymentStatus.pending },
          user: { email: 'customer@example.com' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      paystackBankTransferAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          data: {
            status: 'pay_offline',
            account_number: '1234567890',
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    const service = new PaymentsService(
      prisma as never,
      configService,
      emailService as never,
    );

    await service.retryOrderPayment('order-id', 'customer@example.com');

    const queryParts = queryRaw.mock.calls[0][0] as TemplateStringsArray;
    expect(queryParts.join('?')).toContain('SELECT 1 AS locked');
  });

  it('rejects a webhook with an invalid signature', async () => {
    const webhookLogCreate = jest.fn();
    const service = new PaymentsService(
      { webhookLog: { create: webhookLogCreate } } as never,
      configService,
      emailService as never,
    );
    const payload = { event: 'charge.success', data: {} };
    const rawBody = Buffer.from(JSON.stringify(payload));

    await expect(
      service.webhook(payload, 'invalid-signature', rawBody),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(webhookLogCreate).not.toHaveBeenCalled();
  });

  it('logs a valid webhook before rejecting an unknown payment reference', async () => {
    const webhookLogCreate = jest.fn().mockResolvedValue({});
    const paymentFindUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      webhookLog: { create: webhookLogCreate },
      payment: { findUnique: paymentFindUnique },
    };
    const service = new PaymentsService(
      prisma as never,
      configService,
      emailService as never,
    );
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'unknown-reference',
        amount: 5_000_000,
        currency: 'NGN',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    await expect(
      service.webhook(payload, signature, rawBody),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(webhookLogCreate).toHaveBeenCalledWith({
      data: {
        provider: 'paystack',
        event: 'charge.success',
        reference: 'unknown-reference',
        signature,
        payload,
        rawBody: rawBody.toString('utf8'),
      },
    });
    expect(webhookLogCreate.mock.invocationCallOrder[0]).toBeLessThan(
      paymentFindUnique.mock.invocationCallOrder[0],
    );
  });

  it('marks the payment and order paid for a valid matching webhook', async () => {
    const webhookLogCreate = jest.fn().mockResolvedValue({});
    const paymentUpdate = jest.fn().mockResolvedValue({});
    const orderUpdate = jest.fn().mockResolvedValue({});
    const bankTransferUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      webhookLog: {
        create: webhookLogCreate,
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment-id',
          orderId: 'order-id',
          amount: { toNumber: () => 50_000 },
          currency: 'NGN',
          status: PaymentStatus.pending,
          order: {
            paymentStatus: OrderPaymentStatus.pending,
          },
        }),
        update: paymentUpdate,
      },
      order: {
        update: orderUpdate,
      },
      paystackBankTransferAccount: {
        updateMany: bankTransferUpdateMany,
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new PaymentsService(
      prisma as never,
      configService,
      emailService as never,
    );
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'order_abc123',
        amount: 5_000_000,
        currency: 'NGN',
        paid_at: '2026-06-11T12:05:00.000Z',
      },
    };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');

    await expect(service.webhook(payload, signature, rawBody)).resolves.toEqual(
      {
        received: true,
        paymentStatus: OrderPaymentStatus.paid,
      },
    );
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-id' },
      data: {
        status: PaymentStatus.successful,
        paidAt: new Date('2026-06-11T12:05:00.000Z'),
      },
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-id' },
      data: { paymentStatus: OrderPaymentStatus.paid },
    });
    expect(bankTransferUpdateMany).toHaveBeenCalledWith({
      where: { paymentId: 'payment-id', orderId: 'order-id' },
      data: {
        status: PaymentStatus.successful,
        paidAt: new Date('2026-06-11T12:05:00.000Z'),
        paidRawProviderData: payload.data,
      },
    });
    expect(webhookLogCreate).toHaveBeenCalledTimes(1);
  });
});
