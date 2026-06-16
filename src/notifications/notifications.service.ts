import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationSource,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 100;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createFromAdmin(actor: AuthUser, dto: CreateNotificationDto) {
    this.assertAdmin(actor);

    const notification = await this.createNotification(dto, {
      actorUserId: actor.id,
      source: dto.source ?? NotificationSource.admin,
    });

    return {
      message: 'Notification created successfully.',
      notification,
    };
  }

  async createFromInternal(dto: CreateNotificationDto) {
    const notification = await this.createNotification(dto, {
      source: dto.source ?? NotificationSource.system,
    });

    return {
      message: 'Notification created successfully.',
      notification,
    };
  }

  async findMine(userId: string, query: NotificationQueryDto = {}) {
    const pagination = this.toPagination(query);
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        source: query.source,
        channel: query.channel,
        status: query.status,
        readAt: query.unreadOnly ? null : undefined,
      },
      include: this.notificationInclude(),
      orderBy: { createdAt: 'desc' },
      take: pagination.limit,
      skip: pagination.offset,
    });

    return {
      data: notifications,
      meta: pagination,
    };
  }

  async findOne(userId: string, id: string) {
    const notification = await this.getOwnedNotification(userId, id);
    return { notification };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, readAt: null },
    });

    return { count };
  }

  async markRead(userId: string, id: string) {
    const existing = await this.getOwnedNotification(userId, id);
    const notification = await this.prisma.notification.update({
      where: { id: existing.id },
      data: { readAt: existing.readAt ?? new Date() },
      include: this.notificationInclude(),
    });

    return {
      message: 'Notification marked as read.',
      notification,
    };
  }

  async markAllRead(userId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return {
      message: 'Notifications marked as read.',
      count: updated.count,
    };
  }

  async createNotification(
    dto: CreateNotificationDto,
    defaults: {
      actorUserId?: string;
      source?: NotificationSource;
    } = {},
  ) {
    await this.ensureUserExists(dto.userId);

    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        actorUserId: defaults.actorUserId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        source: defaults.source ?? dto.source ?? NotificationSource.system,
        event: dto.event?.trim(),
        channel: dto.channel,
        status: dto.status ?? NotificationStatus.sent,
        priority: dto.priority,
        orderId: dto.orderId,
        priceAlertId: dto.priceAlertId,
        paymentId: dto.paymentId,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
      },
      include: this.notificationInclude(),
    });
  }

  private async getOwnedNotification(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      include: this.notificationInclude(),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Notification recipient not found');
    }
  }

  private assertAdmin(user: AuthUser) {
    if (!['admin', 'superadmin'].includes(user.role)) {
      throw new ForbiddenException('Only admins can create notifications');
    }
  }

  private notificationInclude() {
    return {
      actor: {
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      },
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
        },
      },
      priceAlert: {
        select: {
          id: true,
          productId: true,
          targetPrice: true,
          unit: true,
          condition: true,
          frequency: true,
          status: true,
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
    } satisfies Prisma.NotificationInclude;
  }

  private toPagination(query: NotificationQueryDto) {
    return {
      limit: this.toBoundedInteger(
        query.limit,
        DEFAULT_NOTIFICATION_LIMIT,
        MAX_NOTIFICATION_LIMIT,
      ),
      offset: this.toBoundedInteger(
        query.offset,
        0,
        Number.MAX_SAFE_INTEGER,
      ),
    };
  }

  private toBoundedInteger(
    value: string | undefined,
    fallback: number,
    max: number,
  ) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      return fallback;
    }

    return Math.min(parsed, max);
  }
}
