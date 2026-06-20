import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderPaymentStatus, PaymentStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { EmailService } from '../mail/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

class PaystackConnectionException extends BadGatewayException {}
class PaystackRejectedException extends BadGatewayException {}

type PaymentInitializationResult = {
  reference: string | null;
  status: PaymentStatus;
  paymentAction: 'none' | 'retry' | 'wait';
  retryAfterSeconds?: number;
  charge?: Record<string, unknown>;
  message?: string;
};

type PaystackBankTransferDetails = {
  accountName?: string;
  accountNumber: string;
  bankName?: string;
  bankCode?: string;
  accountExpiresAt?: Date;
  rawProviderData: Record<string, unknown>;
};

type BankTransferEmailRecipient = {
  email: string;
  fullName?: string | null;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async charge(dto: CreateChargeDto) {
    const secretKey = this.getPaystackSecretKey();

    const accountExpiresAt = new Date(
      Date.now() + 15 * 60 * 1000,
    ).toISOString();

    let response: Response;

    try {
      response = await fetch('https://api.paystack.co/charge', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: dto.email.trim().toLowerCase(),
          amount: dto.amount,
          currency: dto.currency.trim().toUpperCase(),
          reference: dto.reference.trim(),
          bank_transfer: {
            account_expires_at: accountExpiresAt,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new PaystackConnectionException('Unable to connect to Paystack');
    }

    const payload = await this.readPaystackResponse(response);

    if (!response.ok) {
      if (response.status >= 500) {
        throw new PaystackConnectionException(payload);
      }

      throw new PaystackRejectedException(payload);
    }

    if (payload.status !== true) {
      throw new PaystackRejectedException(payload);
    }

    return payload;
  }

  async initializePaymentAttempt(
    paymentId: string,
  ): Promise<PaymentInitializationResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true, user: true },
    });

    if (!payment?.order || !payment.providerReference) {
      throw new NotFoundException('Payment attempt was not found');
    }

    if (payment.order.paymentStatus === OrderPaymentStatus.paid) {
      return {
        reference: payment.providerReference,
        status: PaymentStatus.successful,
        paymentAction: 'none',
      };
    }

    try {
      const charge = await this.charge({
        email: payment.user.email,
        amount: Math.round(payment.amount.toNumber() * 100),
        currency: payment.currency,
        reference: payment.providerReference,
      });
      const savedBankDetails = await this.savePaystackBankTransferAccount(
        payment,
        charge,
      );
      await this.sendNewBankTransferDetailsEmail(
        savedBankDetails,
        payment.user,
      );

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.pending },
      });

      return {
        reference: payment.providerReference,
        status: PaymentStatus.pending,
        paymentAction: 'none',
        charge,
      };
    } catch (error) {
      const uncertain = error instanceof PaystackConnectionException;
      const status = uncertain
        ? PaymentStatus.initializing
        : PaymentStatus.failed;

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status },
      });

      return {
        reference: payment.providerReference,
        status,
        paymentAction: 'retry',
        retryAfterSeconds: uncertain ? 10 : undefined,
        message: uncertain
          ? 'Payment initialization is being confirmed. Retry after 10 seconds.'
          : 'Paystack could not initialize this payment. You can retry.',
      };
    }
  }

  async retryOrderPayment(
    orderId: string,
    email: string,
  ): Promise<PaymentInitializationResult> {
    try {
      return await this.retryOrderPaymentInternal(orderId, email);
    } catch (error) {
      this.logger.error(
        `Payment retry failed for order ${orderId}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  private async retryOrderPaymentInternal(
    orderId: string,
    email: string,
  ): Promise<PaymentInitializationResult> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.user.email !== email.toLowerCase().trim()) {
      throw new UnauthorizedException('Order email does not match');
    }

    if (order.paymentStatus === OrderPaymentStatus.paid) {
      return {
        reference: order.payments[0]?.providerReference ?? null,
        status: PaymentStatus.successful,
        paymentAction: 'none',
        message: 'This order has already been paid.',
      };
    }

    const latestPayment = order.payments[0];

    if (
      latestPayment &&
      (latestPayment.status === PaymentStatus.initializing ||
        latestPayment.status === PaymentStatus.pending)
    ) {
      const ageSeconds = Math.floor(
        (Date.now() - latestPayment.updatedAt.getTime()) / 1000,
      );

      if (ageSeconds < 10) {
        return {
          reference: latestPayment.providerReference,
          status: latestPayment.status,
          paymentAction: 'wait',
          retryAfterSeconds: 10 - ageSeconds,
          message: 'Wait before checking this payment again.',
        };
      }

      const reconciliation = await this.reconcilePaymentAttempt(latestPayment, {
        email: order.user.email,
        fullName: order.user.fullName,
      });

      if (reconciliation) {
        return reconciliation;
      }
    }

    const retryAttempt = await this.createRetryPaymentAttempt(
      order.id,
      order.userId,
      order.total,
      latestPayment?.currency ?? 'NGN',
      order.payments.length + 1,
    );

    if (!retryAttempt.created) {
      return {
        reference: retryAttempt.payment.providerReference,
        status: retryAttempt.payment.status,
        paymentAction: 'wait',
        retryAfterSeconds: 10,
        message: 'A payment retry is already being initialized.',
      };
    }

    return this.initializePaymentAttempt(retryAttempt.payment.id);
  }

  private async reconcilePaymentAttempt(
    payment: {
      id: string;
      orderId: string | null;
      userId: string;
      providerReference: string | null;
      amount: Prisma.Decimal;
      currency: string;
      status: PaymentStatus;
    },
    recipient: BankTransferEmailRecipient,
  ): Promise<PaymentInitializationResult | null> {
    if (!payment.providerReference || !payment.orderId) {
      return null;
    }

    let charge: Record<string, unknown>;

    try {
      charge = await this.checkCharge(payment.providerReference);
    } catch (error) {
      if (error instanceof PaystackConnectionException) {
        return {
          reference: payment.providerReference,
          status: PaymentStatus.initializing,
          paymentAction: 'retry',
          retryAfterSeconds: 10,
          message:
            'Paystack could not be reached. Retry reconciliation in 10 seconds.',
        };
      }

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.failed },
      });
      return null;
    }

    const data = this.getChargeResponseData(charge);
    const status = typeof data.status === 'string' ? data.status : '';

    if (status === 'success') {
      const savedBankDetails = await this.savePaystackBankTransferAccount(
        payment,
        charge,
      );
      await this.sendNewBankTransferDetailsEmail(savedBankDetails, recipient);
      await this.markPaymentPaidFromPaystackData(payment, data);
      return {
        reference: payment.providerReference,
        status: PaymentStatus.successful,
        paymentAction: 'none',
        charge,
      };
    }

    if (status === 'pending' || status === 'pay_offline') {
      const savedBankDetails = await this.savePaystackBankTransferAccount(
        payment,
        charge,
      );
      await this.sendNewBankTransferDetailsEmail(savedBankDetails, recipient);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.pending },
      });
      return {
        reference: payment.providerReference,
        status: PaymentStatus.pending,
        paymentAction: 'none',
        charge,
      };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.failed },
    });
    return null;
  }

  private async checkCharge(
    reference: string,
  ): Promise<Record<string, unknown>> {
    const secretKey = this.getPaystackSecretKey();
    let response: Response;

    try {
      response = await fetch(
        `https://api.paystack.co/charge/${encodeURIComponent(reference)}`,
        {
          headers: { Authorization: `Bearer ${secretKey}` },
          signal: AbortSignal.timeout(15_000),
        },
      );
    } catch {
      throw new PaystackConnectionException('Unable to connect to Paystack');
    }

    const payload = await this.readPaystackResponse(response);

    if (response.status >= 500) {
      throw new PaystackConnectionException(payload);
    }

    if (!response.ok || payload.status !== true) {
      throw new PaystackRejectedException(payload);
    }

    return payload;
  }

  private async createRetryPaymentAttempt(
    orderId: string,
    userId: string,
    amount: Prisma.Decimal,
    currency: string,
    attemptNumber: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        WITH lock AS (
          SELECT pg_advisory_xact_lock(hashtext(${orderId}))
        )
        SELECT 1 AS locked
      `;

      const latestPayment = await tx.payment.findFirst({
        where: { orderId },
        orderBy: { createdAt: 'desc' },
      });
      const paymentCount = await tx.payment.count({ where: { orderId } });

      if (paymentCount >= attemptNumber && latestPayment) {
        return { payment: latestPayment, created: false };
      }

      const payment = await tx.payment.create({
        data: {
          orderId,
          userId,
          amount,
          currency,
          provider: 'paystack',
          providerReference: `order_${orderId}_attempt_${attemptNumber}`,
          status: PaymentStatus.initializing,
        },
      });

      return { payment, created: true };
    });
  }

  private async markPaymentPaidFromPaystackData(
    payment: {
      id: string;
      orderId: string | null;
      userId?: string;
      amount: Prisma.Decimal;
      currency: string;
    },
    data: Record<string, unknown>,
  ) {
    if (!payment.orderId) {
      throw new NotFoundException('Payment order was not found');
    }

    const amount = this.getRequiredNumber(data, 'amount');
    const currency = this.getRequiredString(data, 'currency').toUpperCase();
    const expectedAmount = Math.round(payment.amount.toNumber() * 100);

    if (
      amount !== expectedAmount ||
      currency !== payment.currency.toUpperCase()
    ) {
      throw new BadRequestException(
        'Paystack payment amount or currency does not match the order',
      );
    }

    const paidAtValue =
      typeof data.paid_at === 'string' ? new Date(data.paid_at) : new Date();
    const paidAt = Number.isNaN(paidAtValue.getTime())
      ? new Date()
      : paidAtValue;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.successful, paidAt },
      }),
      this.prisma.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: OrderPaymentStatus.paid },
      }),
      this.prisma.paystackBankTransferAccount.updateMany({
        where: { paymentId: payment.id, orderId: payment.orderId },
        data: {
          status: PaymentStatus.successful,
          paidAt,
          paidRawProviderData: data as Prisma.InputJsonValue,
        },
      }),
    ]);
  }

  private getChargeResponseData(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (
      !payload.data ||
      typeof payload.data !== 'object' ||
      Array.isArray(payload.data)
    ) {
      throw new BadGatewayException('Paystack returned invalid charge data');
    }

    return payload.data as Record<string, unknown>;
  }

  async create(createPaymentDto: CreatePaymentDto) {
    const payment = await this.prisma.payment.create({
      data: this.toPaymentData(createPaymentDto),
      include: { user: true },
    });

    return {
      message: 'Payment created successfully.',
      payment,
    };
  }

  async findAll() {
    const payments = await this.prisma.payment.findMany({
      include: this.paymentInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: payments };
  }

  async findByUser(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      include: this.paymentInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: payments };
  }

  async findByOrder(orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      include: this.paymentInclude(),
      orderBy: { createdAt: 'desc' },
    });

    return { data: payments };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: this.paymentInclude(),
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return { payment };
  }

  async update(id: string, updatePaymentDto: UpdatePaymentDto) {
    try {
      const payment = await this.prisma.payment.update({
        where: { id },
        data: this.toUpdateData(updatePaymentDto),
        include: this.paymentInclude(),
      });

      return {
        message: 'Payment updated successfully.',
        payment,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Payment not found');
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    updatePaymentStatusDto: UpdatePaymentStatusDto,
  ) {
    return this.update(id, {
      status: updatePaymentStatusDto.status,
      paidAt:
        updatePaymentStatusDto.status === PaymentStatus.successful
          ? new Date().toISOString()
          : undefined,
    });
  }

  async verify(providerReference: string) {
    if (!providerReference) {
      throw new BadRequestException('providerReference is required');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { providerReference },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return {
      message: 'Payment verification record found.',
      payment,
    };
  }

  async webhook(
    payload: Record<string, unknown>,
    signature?: string,
    rawBody?: Buffer,
  ) {
    const verifiedWebhook = this.verifyPaystackSignature(
      payload,
      signature,
      rawBody,
    );
    const data =
      payload.data &&
      typeof payload.data === 'object' &&
      !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : undefined;

    await this.prisma.webhookLog.create({
      data: {
        provider: 'paystack',
        event: typeof payload.event === 'string' ? payload.event : undefined,
        reference:
          typeof data?.reference === 'string' ? data.reference : undefined,
        signature: verifiedWebhook.signature,
        payload: payload as Prisma.InputJsonValue,
        rawBody: verifiedWebhook.rawBody.toString('utf8'),
      },
    });

    if (payload.event !== 'charge.success') {
      return { received: true };
    }

    const eventData = this.getPaystackEventData(payload);
    const reference = this.getRequiredString(eventData, 'reference');
    const currency = this.getRequiredString(
      eventData,
      'currency',
    ).toUpperCase();
    const amount = this.getRequiredNumber(eventData, 'amount');
    const paidAtValue =
      typeof eventData.paid_at === 'string'
        ? new Date(eventData.paid_at)
        : new Date();
    const paidAt = Number.isNaN(paidAtValue.getTime())
      ? new Date()
      : paidAtValue;

    const payment = await this.prisma.payment.findUnique({
      where: { providerReference: reference },
      include: { order: true },
    });

    if (!payment?.orderId || !payment.order) {
      throw new NotFoundException('Payment reference was not found');
    }

    const expectedAmount = Math.round(payment.amount.toNumber() * 100);

    if (
      amount !== expectedAmount ||
      currency !== payment.currency.toUpperCase()
    ) {
      throw new BadRequestException(
        'Paystack payment amount or currency does not match the order',
      );
    }

    if (
      payment.status !== PaymentStatus.successful ||
      payment.order.paymentStatus !== OrderPaymentStatus.paid
    ) {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.successful,
            paidAt,
          },
        }),
        this.prisma.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: OrderPaymentStatus.paid },
        }),
        this.prisma.paystackBankTransferAccount.updateMany({
          where: { paymentId: payment.id, orderId: payment.orderId },
          data: {
            status: PaymentStatus.successful,
            paidAt,
            paidRawProviderData: eventData as Prisma.InputJsonValue,
          },
        }),
      ]);
    }

    return {
      received: true,
      paymentStatus: OrderPaymentStatus.paid,
    };
  }

  async remove(id: string) {
    try {
      await this.prisma.payment.delete({
        where: { id },
      });

      return {
        message: 'Payment deleted successfully.',
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Payment not found');
      }

      throw error;
    }
  }

  private toPaymentData(
    dto: CreatePaymentDto,
  ): Prisma.PaymentUncheckedCreateInput {
    return {
      userId: dto.userId,
      orderId: dto.orderId?.trim(),
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase(),
      provider: dto.provider,
      providerReference: dto.providerReference?.trim(),
      status: dto.status,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
    };
  }

  private toUpdateData(
    dto: UpdatePaymentDto,
  ): Prisma.PaymentUncheckedUpdateInput {
    return {
      orderId: dto.orderId?.trim(),
      amount: dto.amount,
      currency: dto.currency?.trim().toUpperCase(),
      provider: dto.provider,
      providerReference: dto.providerReference?.trim(),
      status: dto.status,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
    };
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private paymentInclude() {
    return {
      user: true,
      paystackBankTransferAccounts: {
        orderBy: { createdAt: 'desc' },
      },
    } satisfies Prisma.PaymentInclude;
  }

  private async readPaystackResponse(
    response: Response,
  ): Promise<Record<string, unknown>> {
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new BadGatewayException('Paystack returned an invalid response');
    }
  }

  private async savePaystackBankTransferAccount(
    payment: {
      id: string;
      orderId: string | null;
      userId: string;
      providerReference: string | null;
      amount: Prisma.Decimal;
      currency: string;
    },
    payload: Record<string, unknown>,
  ): Promise<
    | {
        created: boolean;
        details: PaystackBankTransferDetails;
        payment: {
          id: string;
          orderId: string;
          amount: Prisma.Decimal;
          currency: string;
        };
      }
    | undefined
  > {
    if (!payment.orderId || !payment.providerReference) {
      return;
    }

    const details = this.extractPaystackBankTransferDetails(payload);

    if (!details) {
      return;
    }

    const existing = await this.prisma.paystackBankTransferAccount.findUnique({
      where: {
        paymentId_accountNumber: {
          paymentId: payment.id,
          accountNumber: details.accountNumber,
        },
      },
    });

    await this.prisma.paystackBankTransferAccount.upsert({
      where: {
        paymentId_accountNumber: {
          paymentId: payment.id,
          accountNumber: details.accountNumber,
        },
      },
      update: {
        providerReference: payment.providerReference,
        accountName: details.accountName,
        bankName: details.bankName,
        bankCode: details.bankCode,
        amount: payment.amount,
        currency: payment.currency,
        accountExpiresAt: details.accountExpiresAt,
        status: PaymentStatus.pending,
        generatedRawProviderData:
          details.rawProviderData as Prisma.InputJsonValue,
      },
      create: {
        orderId: payment.orderId,
        paymentId: payment.id,
        userId: payment.userId,
        providerReference: payment.providerReference,
        accountName: details.accountName,
        accountNumber: details.accountNumber,
        bankName: details.bankName,
        bankCode: details.bankCode,
        amount: payment.amount,
        currency: payment.currency,
        accountExpiresAt: details.accountExpiresAt,
        status: PaymentStatus.pending,
        generatedRawProviderData:
          details.rawProviderData as Prisma.InputJsonValue,
      },
    });

    return {
      created: !existing,
      details,
      payment: {
        id: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
      },
    };
  }

  private async sendNewBankTransferDetailsEmail(
    savedBankDetails:
      | {
          created: boolean;
          details: PaystackBankTransferDetails;
          payment: {
            orderId: string;
            amount: Prisma.Decimal;
            currency: string;
          };
        }
      | undefined,
    recipient: BankTransferEmailRecipient,
  ): Promise<void> {
    if (!savedBankDetails?.created) {
      return;
    }

    try {
      await this.emailService.sendTemplateEmail({
        to: recipient.email,
        template: 'paystack-bank-transfer',
        variables: {
          fullName: recipient.fullName ?? 'there',
          orderNumber: savedBankDetails.payment.orderId,
          accountName: savedBankDetails.details.accountName ?? '',
          accountNumber: savedBankDetails.details.accountNumber,
          bankName: savedBankDetails.details.bankName ?? '',
          amount: this.formatMoney(
            savedBankDetails.payment.amount.toNumber(),
            savedBankDetails.payment.currency,
          ),
          expiresAt: savedBankDetails.details.accountExpiresAt
            ? savedBankDetails.details.accountExpiresAt.toLocaleString(
                'en-NG',
                {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                },
              )
            : '',
          supportEmail: 'support@ojaboy.com',
        },
      });
    } catch (error) {
      this.logger.error(
        `Paystack bank transfer details for order ${savedBankDetails.payment.orderId} were saved, but the email could not be sent`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private extractPaystackBankTransferDetails(
    payload: Record<string, unknown>,
  ): PaystackBankTransferDetails | undefined {
    const data = this.getChargeResponseData(payload);
    const bank = this.getOptionalRecord(data, 'bank');
    const bankTransfer = this.getOptionalRecord(data, 'bank_transfer');
    const accountNumber =
      this.getOptionalString(data, 'account_number') ??
      this.getOptionalString(data, 'accountNumber') ??
      this.getOptionalString(bankTransfer, 'account_number') ??
      this.getOptionalString(bankTransfer, 'accountNumber');

    if (!accountNumber) {
      return undefined;
    }

    return {
      accountNumber,
      accountName:
        this.getOptionalString(data, 'account_name') ??
        this.getOptionalString(data, 'accountName') ??
        this.getOptionalString(bankTransfer, 'account_name') ??
        this.getOptionalString(bankTransfer, 'accountName'),
      bankName:
        this.getOptionalString(data, 'bank_name') ??
        this.getOptionalString(data, 'bankName') ??
        this.getOptionalString(bank, 'name') ??
        this.getOptionalString(bankTransfer, 'bank_name') ??
        this.getOptionalString(bankTransfer, 'bankName'),
      bankCode:
        this.getOptionalString(data, 'bank_code') ??
        this.getOptionalString(data, 'bankCode') ??
        this.getOptionalString(bank, 'code') ??
        this.getOptionalString(bank, 'slug') ??
        this.getOptionalString(bankTransfer, 'bank_code') ??
        this.getOptionalString(bankTransfer, 'bankCode'),
      accountExpiresAt: this.parseOptionalDate(
        this.getOptionalString(data, 'account_expires_at') ??
          this.getOptionalString(data, 'accountExpiresAt') ??
          this.getOptionalString(bankTransfer, 'account_expires_at') ??
          this.getOptionalString(bankTransfer, 'accountExpiresAt'),
      ),
      rawProviderData: data,
    };
  }

  private getOptionalRecord(
    data: Record<string, unknown> | undefined,
    field: string,
  ): Record<string, unknown> | undefined {
    const value = data?.[field];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private getOptionalString(
    data: Record<string, unknown> | undefined,
    field: string,
  ): string | undefined {
    const value = data?.[field];

    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private parseOptionalDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private formatMoney(value: number, currency: string): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private verifyPaystackSignature(
    payload: Record<string, unknown>,
    signature?: string,
    rawBody?: Buffer,
  ): { signature: string; rawBody: Buffer } {
    const secretKey = this.getPaystackSecretKey();

    if (!signature) {
      throw new UnauthorizedException('Paystack signature is required');
    }

    const body = rawBody ?? Buffer.from(JSON.stringify(payload));
    const expectedSignature = createHmac('sha512', secretKey)
      .update(body)
      .digest('hex');
    const received = Buffer.from(signature, 'utf8');
    const expected = Buffer.from(expectedSignature, 'utf8');

    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }

    return { signature, rawBody: body };
  }

  private getPaystackSecretKey(): string {
    const secretKey = this.configService
      .get<string>('PAYSTACK_SECRET_KEY')
      ?.trim();

    if (!secretKey) {
      throw new ServiceUnavailableException(
        'Paystack payment service is not configured',
      );
    }

    return secretKey;
  }

  private getPaystackEventData(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (
      !payload.data ||
      typeof payload.data !== 'object' ||
      Array.isArray(payload.data)
    ) {
      throw new BadRequestException('Paystack webhook data is invalid');
    }

    return payload.data as Record<string, unknown>;
  }

  private getRequiredString(
    data: Record<string, unknown>,
    field: string,
  ): string {
    const value = data[field];

    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`Paystack webhook ${field} is invalid`);
    }

    return value.trim();
  }

  private getRequiredNumber(
    data: Record<string, unknown>,
    field: string,
  ): number {
    const value = Number(data[field]);

    if (!Number.isFinite(value)) {
      throw new BadRequestException(`Paystack webhook ${field} is invalid`);
    }

    return value;
  }
}
