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

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('adds a bank transfer expiry exactly 15 minutes ahead', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-11T12:00:00.000Z'));

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const service = new PaymentsService({} as never, configService);

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
          user: { email: 'customer@example.com' },
        }),
        update: paymentUpdate,
      },
    };
    const service = new PaymentsService(prisma as never, configService);

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
          user: { email: 'customer@example.com' },
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
    const service = new PaymentsService(prisma as never, configService);

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
          user: { email: 'customer@example.com' },
          payments: [
            {
              id: 'payment-id',
              orderId: 'order-id',
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
    };
    const service = new PaymentsService(prisma as never, configService);

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
  });

  it('rejects a webhook with an invalid signature', async () => {
    const webhookLogCreate = jest.fn();
    const service = new PaymentsService(
      { webhookLog: { create: webhookLogCreate } } as never,
      configService,
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
    const service = new PaymentsService(prisma as never, configService);
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
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const service = new PaymentsService(prisma as never, configService);
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
    expect(webhookLogCreate).toHaveBeenCalledTimes(1);
  });
});
