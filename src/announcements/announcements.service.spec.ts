import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AnnouncementAudienceType,
  AnnouncementStatus,
  AnnouncementType,
} from '@prisma/client';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

describe('AnnouncementsService', () => {
  const emailService = { sendTemplateEmail: jest.fn() };

  const baseDto: CreateAnnouncementDto = {
    type: AnnouncementType.promotion,
    title: 'Weekend discount',
    body: 'Enjoy 10% off this weekend.',
    audience: { type: AnnouncementAudienceType.all },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a "role" audience with no role provided', async () => {
    const prisma = { announcement: { create: jest.fn() } };
    const service = new AnnouncementsService(
      prisma as never,
      emailService as never,
    );

    await expect(
      service.create({
        ...baseDto,
        audience: { type: AnnouncementAudienceType.role },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.announcement.create).not.toHaveBeenCalled();
  });

  it('rejects a "specific_users" audience with no userIds provided', async () => {
    const prisma = { announcement: { create: jest.fn() } };
    const service = new AnnouncementsService(
      prisma as never,
      emailService as never,
    );

    await expect(
      service.create({
        ...baseDto,
        audience: { type: AnnouncementAudienceType.specific_users },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a draft announcement and immediately fans it out to all users', async () => {
    const created: {
      id: string;
      status: AnnouncementStatus;
      audienceType: AnnouncementAudienceType;
      audienceRole: string | null;
      audienceUserIds: string[];
    } = {
      id: 'announcement-id',
      status: AnnouncementStatus.draft,
      audienceType: AnnouncementAudienceType.all,
      audienceRole: null,
      audienceUserIds: [],
    };
    const create = jest
      .fn<Promise<typeof created>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue(created);
    const findUnique = jest.fn().mockResolvedValue(created);
    const update = jest
      .fn<
        Promise<typeof created & { status: AnnouncementStatus }>,
        [{ data: Record<string, unknown> }]
      >()
      .mockResolvedValue({
        ...created,
        status: AnnouncementStatus.sending,
      });
    const findMany = jest
      .fn()
      .mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
    const createMany = jest.fn().mockResolvedValue({ count: 2 });

    const prisma = {
      announcement: { create, findUnique, update },
      announcementRecipient: { createMany },
      user: { findMany },
    };

    const service = new AnnouncementsService(
      prisma as never,
      emailService as never,
    );

    const result = await service.create(baseDto);

    expect(create.mock.calls[0][0].data).toMatchObject({
      status: AnnouncementStatus.draft,
      emailTemplate: 'announcement-promotion',
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { announcementId: 'announcement-id', userId: 'user-1' },
        { announcementId: 'announcement-id', userId: 'user-2' },
      ],
      skipDuplicates: true,
    });
    expect(update.mock.calls[0][0].data).toMatchObject({
      status: AnnouncementStatus.sending,
      totalRecipients: 2,
    });
    expect(result.announcement.status).toBe(AnnouncementStatus.sending);
  });

  it('schedules for later instead of publishing when scheduledAt is in the future', async () => {
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const created = {
      id: 'announcement-id',
      status: AnnouncementStatus.scheduled,
    };
    const create = jest
      .fn<Promise<typeof created>, [{ data: Record<string, unknown> }]>()
      .mockResolvedValue(created);
    const prisma = { announcement: { create } };

    const service = new AnnouncementsService(
      prisma as never,
      emailService as never,
    );

    await service.create({ ...baseDto, scheduledAt });

    expect(create.mock.calls[0][0].data).toMatchObject({
      status: AnnouncementStatus.scheduled,
    });
  });

  it('throws when publishing an announcement that does not exist', async () => {
    const prisma = {
      announcement: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new AnnouncementsService(
      prisma as never,
      emailService as never,
    );

    await expect(service.publish('missing-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('paginates and applies a case-insensitive title/body search', async () => {
    const findMany = jest
      .fn<Promise<never[]>, [Record<string, unknown>]>()
      .mockResolvedValue([]);
    const count = jest
      .fn<Promise<number>, [Record<string, unknown>]>()
      .mockResolvedValue(37);
    const prisma = { announcement: { findMany, count } };
    const service = new AnnouncementsService(
      prisma as never,
      emailService as never,
    );

    const result = await service.findAll({
      page: 2,
      limit: 10,
      search: 'weekend',
    });

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        OR: [
          { title: { contains: 'weekend', mode: 'insensitive' } },
          { body: { contains: 'weekend', mode: 'insensitive' } },
        ],
      },
      skip: 10,
      take: 10,
    });
    expect(count.mock.calls[0][0]).toMatchObject({
      where: {
        OR: [
          { title: { contains: 'weekend', mode: 'insensitive' } },
          { body: { contains: 'weekend', mode: 'insensitive' } },
        ],
      },
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 37,
      totalPages: 4,
    });
  });
});
