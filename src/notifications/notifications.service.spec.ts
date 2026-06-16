import {
  NotificationSource,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const admin = {
    id: 'admin-id',
    email: 'admin@example.com',
    fullName: 'Admin',
    role: 'admin',
    authProviders: ['password'],
    emailVerified: true,
  };
  const userId = 'user-id';
  const notification = {
    id: 'notification-id',
    userId,
    actorUserId: admin.id,
    title: 'Order update',
    body: 'Your order is now processing.',
    source: NotificationSource.admin,
    event: 'admin_message',
    channel: 'in_app',
    status: NotificationStatus.sent,
    priority: 'normal',
    readAt: null,
    sentAt: new Date(),
    deliveredAt: null,
    failedAt: null,
    failureReason: null,
    orderId: null,
    priceAlertId: null,
    paymentId: null,
    metadata: { orderId: 'order-id' } as Prisma.JsonObject,
    createdAt: new Date(),
    updatedAt: new Date(),
    actor: {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
    },
    order: null,
    priceAlert: null,
    payment: null,
  };

  it('creates an admin-triggered notification for a user', async () => {
    const create = jest.fn().mockResolvedValue(notification);
    const service = new NotificationsService({
      user: { findUnique: jest.fn().mockResolvedValue({ id: userId }) },
      notification: { create },
    } as never);

    const result = await service.createFromAdmin(admin, {
      userId,
      title: ' Order update ',
      body: ' Your order is now processing. ',
      event: 'admin_message',
      metadata: { orderId: 'order-id' },
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId,
          actorUserId: admin.id,
          title: 'Order update',
          body: 'Your order is now processing.',
          source: NotificationSource.admin,
          status: NotificationStatus.sent,
          metadata: { orderId: 'order-id' },
        }),
      }),
    );
    expect(result.notification).toBe(notification);
  });

  it('lists notifications for only the authenticated user', async () => {
    const findMany = jest.fn().mockResolvedValue([notification]);
    const service = new NotificationsService({
      notification: { findMany },
    } as never);

    const result = await service.findMine(userId, {
      unreadOnly: true,
      limit: '10',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId, readAt: null }),
        take: 10,
        skip: 0,
      }),
    );
    expect(result.data).toEqual([notification]);
  });

  it('returns unread notification count', async () => {
    const count = jest.fn().mockResolvedValue(3);
    const service = new NotificationsService({
      notification: { count },
    } as never);

    await expect(service.getUnreadCount(userId)).resolves.toEqual({ count: 3 });
    expect(count).toHaveBeenCalledWith({ where: { userId, readAt: null } });
  });

  it('marks an owned notification as read', async () => {
    const update = jest.fn().mockResolvedValue({
      ...notification,
      readAt: new Date(),
    });
    const service = new NotificationsService({
      notification: {
        findFirst: jest.fn().mockResolvedValue(notification),
        update,
      },
    } as never);

    const result = await service.markRead(userId, notification.id);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: notification.id },
        data: { readAt: expect.any(Date) },
      }),
    );
    expect(result.message).toBe('Notification marked as read.');
  });
});
