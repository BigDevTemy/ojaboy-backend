import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: payments };
  }

  async findByUser(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: payments };
  }

  async findByOrder(orderId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: payments };
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { user: true },
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
        include: { user: true },
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

  async updateStatus(id: string, updatePaymentStatusDto: UpdatePaymentStatusDto) {
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

  webhook(payload: Record<string, unknown>) {
    return {
      message: 'Payment webhook received.',
      payload,
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

  private toUpdateData(dto: UpdatePaymentDto): Prisma.PaymentUncheckedUpdateInput {
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
}
