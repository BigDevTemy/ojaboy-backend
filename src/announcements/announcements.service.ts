import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AnnouncementAudienceType,
  AnnouncementRecipientStatus,
  AnnouncementStatus,
  AnnouncementType,
} from '@prisma/client';
import { EmailTemplateName } from '../mail/email-template.types';
import { EmailService } from '../mail/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementQueryDto } from './dto/announcement-query.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

const FANOUT_CHUNK_SIZE = 1000;
const DISPATCH_BATCH_SIZE = 200;
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_SECONDS = 60;
const MAX_BACKOFF_SECONDS = 3600;

const DEFAULT_TEMPLATE: Record<AnnouncementType, EmailTemplateName> = {
  closure: 'announcement-closure',
  coupon: 'announcement-coupon',
  promotion: 'announcement-promotion',
  custom: 'announcement-custom',
};

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: CreateAnnouncementDto, createdByUserId?: string) {
    this.validateAudience(dto.audience);

    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const isFutureSchedule =
      scheduledAt !== undefined && scheduledAt.getTime() > Date.now();

    const announcement = await this.prisma.announcement.create({
      data: {
        type: dto.type,
        title: dto.title.trim(),
        body: dto.body.trim(),
        emailTemplate: DEFAULT_TEMPLATE[dto.type],
        templateVariables: dto.templateVariables,
        audienceType: dto.audience.type,
        audienceRole: dto.audience.role?.trim(),
        audienceUserIds: [...new Set(dto.audience.userIds ?? [])],
        status: isFutureSchedule
          ? AnnouncementStatus.scheduled
          : AnnouncementStatus.draft,
        scheduledAt,
        createdByUserId,
      },
    });

    if (!isFutureSchedule) {
      const published = await this.publish(announcement.id);

      return {
        message: 'Announcement created and queued for delivery.',
        announcement: published,
      };
    }

    return { message: 'Announcement scheduled successfully.', announcement };
  }

  async findAll(query: AnnouncementQueryDto = { page: 1, limit: 50 }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim();

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { body: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [announcements, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      data: announcements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const announcement = await this.getAnnouncementOrThrow(id);
    const counts = await this.prisma.announcementRecipient.groupBy({
      by: ['status'],
      where: { announcementId: id },
      _count: { _all: true },
    });

    const progress: Record<AnnouncementRecipientStatus, number> = {
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
    };

    for (const row of counts) {
      progress[row.status] = row._count._all;
    }

    return { announcement, progress };
  }

  async cancel(id: string) {
    const announcement = await this.getAnnouncementOrThrow(id);

    if (
      announcement.status === AnnouncementStatus.sent ||
      announcement.status === AnnouncementStatus.cancelled
    ) {
      throw new BadRequestException('Announcement can no longer be cancelled');
    }

    await this.prisma.announcementRecipient.deleteMany({
      where: {
        announcementId: id,
        status: AnnouncementRecipientStatus.pending,
      },
    });

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: { status: AnnouncementStatus.cancelled, completedAt: new Date() },
    });

    return {
      message: 'Announcement cancelled successfully.',
      announcement: updated,
    };
  }

  async publish(id: string) {
    const announcement = await this.getAnnouncementOrThrow(id);

    if (
      announcement.status !== AnnouncementStatus.draft &&
      announcement.status !== AnnouncementStatus.scheduled
    ) {
      throw new BadRequestException(
        'Announcement has already been published or cancelled',
      );
    }

    const userIds = await this.resolveAudienceUserIds(announcement);

    if (userIds.length === 0) {
      return this.prisma.announcement.update({
        where: { id },
        data: {
          status: AnnouncementStatus.sent,
          publishedAt: new Date(),
          completedAt: new Date(),
          totalRecipients: 0,
        },
      });
    }

    for (let i = 0; i < userIds.length; i += FANOUT_CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + FANOUT_CHUNK_SIZE);
      await this.prisma.announcementRecipient.createMany({
        data: chunk.map((userId) => ({ announcementId: id, userId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.announcement.update({
      where: { id },
      data: {
        status: AnnouncementStatus.sending,
        publishedAt: new Date(),
        totalRecipients: userIds.length,
      },
    });
  }

  /** Invoked by AnnouncementDispatchService on a schedule. */
  async runDispatchCycle() {
    await this.publishDueScheduled();
    await this.processBatch();
  }

  private async publishDueScheduled() {
    const due = await this.prisma.announcement.findMany({
      where: {
        status: AnnouncementStatus.scheduled,
        scheduledAt: { lte: new Date() },
      },
      select: { id: true },
    });

    for (const { id } of due) {
      await this.publish(id);
    }
  }

  private async processBatch() {
    const ids = await this.claimBatch(DISPATCH_BATCH_SIZE);

    if (ids.length === 0) {
      return;
    }

    const recipients = await this.prisma.announcementRecipient.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
        announcement: true,
      },
    });

    const touchedAnnouncementIds = new Set<string>();

    for (const recipient of recipients) {
      touchedAnnouncementIds.add(recipient.announcementId);
      const { announcement, user } = recipient;

      try {
        await this.emailService.sendTemplateEmail({
          to: user.email,
          template: announcement.emailTemplate as EmailTemplateName,
          variables: {
            ...((announcement.templateVariables as Record<
              string,
              string | number
            > | null) ?? {}),
            title: announcement.title,
            body: announcement.body,
            fullName: user.fullName,
          },
        });

        await this.prisma.announcementRecipient.update({
          where: { id: recipient.id },
          data: {
            status: AnnouncementRecipientStatus.sent,
            sentAt: new Date(),
          },
        });
      } catch (error) {
        const attempts = recipient.attempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;

        await this.prisma.announcementRecipient.update({
          where: { id: recipient.id },
          data: {
            attempts,
            status: failed
              ? AnnouncementRecipientStatus.failed
              : AnnouncementRecipientStatus.pending,
            nextAttemptAt: failed
              ? recipient.nextAttemptAt
              : new Date(Date.now() + this.backoffMs(attempts)),
            lastError: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }

    for (const announcementId of touchedAnnouncementIds) {
      await this.finalizeIfComplete(announcementId);
    }
  }

  private async claimBatch(batchSize: number): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM announcement_recipients
        WHERE status = 'pending' AND next_attempt_at <= now()
        ORDER BY id
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;
      const ids = rows.map((row) => row.id);

      if (ids.length === 0) {
        return [];
      }

      await tx.announcementRecipient.updateMany({
        where: { id: { in: ids } },
        data: { status: AnnouncementRecipientStatus.processing },
      });

      return ids;
    });
  }

  private async finalizeIfComplete(announcementId: string) {
    const remaining = await this.prisma.announcementRecipient.count({
      where: {
        announcementId,
        status: {
          in: [
            AnnouncementRecipientStatus.pending,
            AnnouncementRecipientStatus.processing,
          ],
        },
      },
    });

    if (remaining > 0) {
      return;
    }

    const [sentCount, failedCount] = await Promise.all([
      this.prisma.announcementRecipient.count({
        where: { announcementId, status: AnnouncementRecipientStatus.sent },
      }),
      this.prisma.announcementRecipient.count({
        where: { announcementId, status: AnnouncementRecipientStatus.failed },
      }),
    ]);

    await this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        status:
          failedCount > 0
            ? AnnouncementStatus.partially_failed
            : AnnouncementStatus.sent,
        sentCount,
        failedCount,
        completedAt: new Date(),
      },
    });
  }

  private backoffMs(attempts: number): number {
    return (
      Math.min(
        BACKOFF_BASE_SECONDS * 2 ** (attempts - 1),
        MAX_BACKOFF_SECONDS,
      ) * 1000
    );
  }

  private async resolveAudienceUserIds(announcement: {
    audienceType: AnnouncementAudienceType;
    audienceRole: string | null;
    audienceUserIds: string[];
  }): Promise<string[]> {
    if (announcement.audienceType === AnnouncementAudienceType.specific_users) {
      if (announcement.audienceUserIds.length === 0) {
        return [];
      }

      const users = await this.prisma.user.findMany({
        where: { id: { in: announcement.audienceUserIds } },
        select: { id: true },
      });

      return users.map((user) => user.id);
    }

    const where =
      announcement.audienceType === AnnouncementAudienceType.role
        ? { role: announcement.audienceRole ?? undefined }
        : {};

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  private validateAudience(audience: {
    type: AnnouncementAudienceType;
    role?: string;
    userIds?: string[];
  }) {
    if (
      audience.type === AnnouncementAudienceType.role &&
      !audience.role?.trim()
    ) {
      throw new BadRequestException(
        'role is required when audience type is "role"',
      );
    }

    if (
      audience.type === AnnouncementAudienceType.specific_users &&
      (!audience.userIds || audience.userIds.length === 0)
    ) {
      throw new BadRequestException(
        'userIds is required when audience type is "specific_users"',
      );
    }
  }

  private async getAnnouncementOrThrow(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return announcement;
  }
}
