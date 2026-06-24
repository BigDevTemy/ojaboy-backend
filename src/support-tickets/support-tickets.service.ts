import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  NotificationPriority,
  NotificationSource,
  Prisma,
  SupportTicketAssignmentMethod,
  SupportTicketSenderType,
  SupportTicketStatus,
} from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportTicketMessageDto } from './dto/create-support-ticket-message.dto';
import { ReassignSupportTicketDto } from './dto/reassign-support-ticket.dto';
import { SupportTicketQueryDto } from './dto/support-ticket-query.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import {
  ALLOWED_SUPPORT_ATTACHMENT_TYPES,
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_ATTACHMENT_SIZE,
} from './support-ticket-upload';

const ACTIVE_TICKET_STATUSES = [
  SupportTicketStatus.open,
  SupportTicketStatus.in_review,
  SupportTicketStatus.waiting_on_customer,
];

@Injectable()
export class SupportTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    customer: AuthUser,
    dto: CreateSupportTicketDto,
    files: Express.Multer.File[] = [],
  ) {
    this.validateAttachments(files);

    if (dto.orderId) {
      await this.ensureCustomerOwnsOrder(customer.id, dto.orderId);
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext('support-ticket-assignment'))",
      );

      const assignee = await this.selectAssignee(tx);
      const ticketNumber = await this.nextTicketNumber(tx);
      const now = new Date();

      const created = await tx.supportTicket.create({
        data: {
          ticketNumber,
          customerId: customer.id,
          assignedToId: assignee.id,
          orderId: dto.orderId,
          subject: dto.subject.trim(),
          category: dto.category,
          priority: dto.priority,
          assignedAt: now,
          lastMessageAt: now,
          messages: {
            create: {
              senderId: customer.id,
              senderType: SupportTicketSenderType.customer,
              message: dto.message.trim(),
              attachments: {
                create: this.toAttachmentData(files),
              },
            },
          },
          assignmentHistory: {
            create: {
              newAssigneeId: assignee.id,
              method: SupportTicketAssignmentMethod.auto,
              reason: 'Automatically assigned when the ticket was created',
            },
          },
        },
        include: this.ticketDetailsInclude(),
      });

      await this.createNotification(tx, {
        userId: assignee.id,
        title: `New support ticket ${ticketNumber}`,
        body: dto.subject.trim(),
        event: 'support_ticket_assigned',
        ticketId: created.id,
        priority: NotificationPriority.high,
      });

      return created;
    });

    return {
      message: 'Support ticket created and assigned successfully.',
      ticket,
    };
  }

  async findMine(userId: string, query: SupportTicketQueryDto) {
    return this.findMany(
      {
        customerId: userId,
        ...this.buildFilters(query),
      },
      query,
    );
  }

  async findAssignedToMe(admin: AuthUser, query: SupportTicketQueryDto) {
    this.assertAdmin(admin);

    return this.findMany(
      {
        ...this.buildFilters(query),
        assignedToId: admin.id,
      },
      query,
    );
  }

  async findAdminTickets(admin: AuthUser, query: SupportTicketQueryDto) {
    this.assertAdmin(admin);
    return this.findMany(this.buildFilters(query), query);
  }

  async listSupportStaff(admin: AuthUser) {
    this.assertAdmin(admin);

    const staff = await this.prisma.user.findMany({
      where: { role: { in: ['admin', 'superadmin'] } },
      select: {
        ...this.userSelect(),
        _count: {
          select: {
            assignedSupportTickets: {
              where: { status: { in: ACTIVE_TICKET_STATUSES } },
            },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    return {
      data: staff.map(({ _count, ...member }) => ({
        ...member,
        activeTicketCount: _count.assignedSupportTickets,
      })),
    };
  }

  async getMySummary(userId: string) {
    const grouped = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      where: { customerId: userId },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(
      Object.values(SupportTicketStatus).map((status) => [status, 0]),
    ) as Record<SupportTicketStatus, number>;

    for (const item of grouped) {
      counts[item.status] = item._count._all;
    }

    return {
      activeCases: counts.open + counts.in_review + counts.waiting_on_customer,
      needsYourReply: counts.waiting_on_customer,
      resolved: counts.resolved,
      total: Object.values(counts).reduce((sum, count) => sum + count, 0),
      byStatus: counts,
    };
  }

  async findOne(actor: AuthUser, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: this.ticketDetailsInclude(),
    });

    if (!ticket || (!this.isAdmin(actor) && ticket.customerId !== actor.id)) {
      throw new NotFoundException('Support ticket not found');
    }

    return { ticket };
  }

  async addMessage(
    actor: AuthUser,
    ticketId: string,
    dto: CreateSupportTicketMessageDto,
    files: Express.Multer.File[] = [],
  ) {
    this.validateAttachments(files);

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.supportTicket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          ticketNumber: true,
          customerId: true,
          assignedToId: true,
          status: true,
        },
      });

      if (!ticket || (!this.isAdmin(actor) && ticket.customerId !== actor.id)) {
        throw new NotFoundException('Support ticket not found');
      }

      const senderType = this.isAdmin(actor)
        ? SupportTicketSenderType.staff
        : SupportTicketSenderType.customer;
      if (
        senderType === SupportTicketSenderType.customer &&
        dto.status !== undefined
      ) {
        throw new ForbiddenException(
          'Customers cannot set a support ticket status',
        );
      }

      const nextStatus =
        senderType === SupportTicketSenderType.customer
          ? SupportTicketStatus.in_review
          : (dto.status ?? ticket.status);
      const now = new Date();

      const message = await tx.supportTicketMessage.create({
        data: {
          ticketId,
          senderId: actor.id,
          senderType,
          message: dto.message.trim(),
          attachments: {
            create: this.toAttachmentData(files),
          },
        },
        include: {
          sender: { select: this.userSelect() },
          attachments: { select: this.attachmentSelect() },
        },
      });

      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          lastMessageAt: now,
          status: nextStatus,
          resolvedAt: nextStatus === SupportTicketStatus.resolved ? now : null,
        },
      });

      const recipientId =
        senderType === SupportTicketSenderType.customer
          ? ticket.assignedToId
          : ticket.customerId;

      await this.createNotification(tx, {
        userId: recipientId,
        actorUserId: actor.id,
        title: `New reply on ${ticket.ticketNumber}`,
        body: dto.message.trim().slice(0, 160),
        event: 'support_ticket_reply',
        ticketId,
      });

      return {
        reply: message,
        status: nextStatus,
      };
    });

    return {
      message: 'Reply added successfully.',
      ...result,
    };
  }

  async reassign(
    actor: AuthUser,
    ticketId: string,
    dto: ReassignSupportTicketDto,
  ) {
    this.assertAdmin(actor);

    const ticket = await this.prisma.$transaction(async (tx) => {
      const [existing, newAssignee] = await Promise.all([
        tx.supportTicket.findUnique({
          where: { id: ticketId },
          select: {
            id: true,
            ticketNumber: true,
            assignedToId: true,
          },
        }),
        tx.user.findFirst({
          where: {
            id: dto.assignedToId,
            role: { in: ['admin', 'superadmin'] },
          },
          select: this.userSelect(),
        }),
      ]);

      if (!existing) {
        throw new NotFoundException('Support ticket not found');
      }
      if (!newAssignee) {
        throw new BadRequestException(
          'The new assignee must be an admin or superadmin',
        );
      }
      if (existing.assignedToId === newAssignee.id) {
        throw new BadRequestException(
          'The ticket is already assigned to this staff member',
        );
      }

      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          assignedToId: newAssignee.id,
          assignedAt: new Date(),
          assignmentHistory: {
            create: {
              previousAssigneeId: existing.assignedToId,
              newAssigneeId: newAssignee.id,
              assignedById: actor.id,
              method: SupportTicketAssignmentMethod.manual,
              reason: dto.reason?.trim(),
            },
          },
        },
        include: this.ticketDetailsInclude(),
      });

      await Promise.all([
        this.createNotification(tx, {
          userId: newAssignee.id,
          actorUserId: actor.id,
          title: `Support ticket ${existing.ticketNumber} assigned to you`,
          body: dto.reason?.trim() || 'The ticket was reassigned to you.',
          event: 'support_ticket_reassigned',
          ticketId,
          priority: NotificationPriority.high,
        }),
        this.createNotification(tx, {
          userId: existing.assignedToId,
          actorUserId: actor.id,
          title: `Support ticket ${existing.ticketNumber} reassigned`,
          body: `The ticket was reassigned to ${newAssignee.fullName}.`,
          event: 'support_ticket_reassigned_from',
          ticketId,
        }),
      ]);

      return updated;
    });

    return {
      message: 'Support ticket reassigned successfully.',
      ticket,
    };
  }

  async updateStatus(
    actor: AuthUser,
    ticketId: string,
    dto: UpdateSupportTicketStatusDto,
  ) {
    this.assertAdmin(actor);

    const existing = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, customerId: true, ticketNumber: true },
    });

    if (!existing) {
      throw new NotFoundException('Support ticket not found');
    }

    const ticket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        resolvedAt:
          dto.status === SupportTicketStatus.resolved ? new Date() : null,
      },
      include: this.ticketDetailsInclude(),
    });

    await this.prisma.notification.create({
      data: {
        userId: existing.customerId,
        actorUserId: actor.id,
        title: `Support ticket ${existing.ticketNumber} updated`,
        body: `Status changed to ${dto.status.replaceAll('_', ' ')}.`,
        source: NotificationSource.admin,
        event: 'support_ticket_status_changed',
        metadata: { ticketId },
      },
    });

    return {
      message: 'Support ticket status updated successfully.',
      ticket,
    };
  }

  async getAttachment(actor: AuthUser, attachmentId: string) {
    const attachment = await this.prisma.supportTicketAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        message: {
          select: {
            ticket: {
              select: { customerId: true },
            },
          },
        },
      },
    });

    if (
      !attachment ||
      (!this.isAdmin(actor) &&
        attachment.message.ticket.customerId !== actor.id)
    ) {
      throw new NotFoundException('Attachment not found');
    }

    return attachment;
  }

  private async findMany(
    where: Prisma.SupportTicketWhereInput,
    query: SupportTicketQueryDto,
  ) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: this.ticketListInclude(),
        orderBy: { lastMessageAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  private buildFilters(
    query: SupportTicketQueryDto,
  ): Prisma.SupportTicketWhereInput {
    const search = query.search?.trim();

    return {
      status: query.status,
      priority: query.priority,
      assignedToId: query.assignedToId,
      OR: search
        ? [
            { ticketNumber: { contains: search, mode: 'insensitive' } },
            { subject: { contains: search, mode: 'insensitive' } },
            { order: { id: { contains: search, mode: 'insensitive' } } },
          ]
        : undefined,
    };
  }

  private async selectAssignee(tx: Prisma.TransactionClient) {
    const staff = await tx.user.findMany({
      where: { role: { in: ['admin', 'superadmin'] } },
      select: {
        ...this.userSelect(),
        _count: {
          select: {
            assignedSupportTickets: {
              where: { status: { in: ACTIVE_TICKET_STATUSES } },
            },
          },
        },
        assignedSupportTickets: {
          select: { assignedAt: true },
          orderBy: { assignedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (staff.length === 0) {
      throw new ServiceUnavailableException(
        'No admin staff is available to receive this support ticket',
      );
    }

    return staff.sort((left, right) => {
      const workloadDifference =
        left._count.assignedSupportTickets -
        right._count.assignedSupportTickets;
      if (workloadDifference !== 0) return workloadDifference;

      const leftLastAssigned =
        left.assignedSupportTickets[0]?.assignedAt.getTime() ?? 0;
      const rightLastAssigned =
        right.assignedSupportTickets[0]?.assignedAt.getTime() ?? 0;
      return leftLastAssigned - rightLastAssigned;
    })[0];
  }

  private async nextTicketNumber(tx: Prisma.TransactionClient) {
    const [sequence] = await tx.$queryRawUnsafe<Array<{ value: bigint }>>(
      "SELECT nextval('support_ticket_number_seq') AS value",
    );
    return `SUP-${sequence.value.toString()}`;
  }

  private async ensureCustomerOwnsOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this customer');
    }
  }

  private validateAttachments(files: Express.Multer.File[]) {
    if (files.length > MAX_SUPPORT_ATTACHMENTS) {
      throw new BadRequestException(
        `A maximum of ${MAX_SUPPORT_ATTACHMENTS} attachments is allowed`,
      );
    }

    for (const file of files) {
      if (!ALLOWED_SUPPORT_ATTACHMENT_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          'Attachments must be JPEG, PNG, WebP, PDF, DOC, or DOCX files',
        );
      }
      if (file.size > MAX_SUPPORT_ATTACHMENT_SIZE) {
        throw new BadRequestException('Each attachment must not exceed 10 MB');
      }
    }
  }

  private toAttachmentData(files: Express.Multer.File[]) {
    return files.map((file) => {
      const data = new Uint8Array(file.buffer.byteLength);
      data.set(file.buffer);

      return {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        data,
      };
    });
  }

  private createNotification(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      actorUserId?: string;
      title: string;
      body: string;
      event: string;
      ticketId: string;
      priority?: NotificationPriority;
    },
  ) {
    return tx.notification.create({
      data: {
        userId: input.userId,
        actorUserId: input.actorUserId,
        title: input.title,
        body: input.body,
        source: input.actorUserId
          ? NotificationSource.admin
          : NotificationSource.system,
        event: input.event,
        priority: input.priority,
        metadata: { ticketId: input.ticketId },
      },
    });
  }

  private ticketListInclude() {
    return {
      customer: { select: this.userSelect() },
      assignedTo: { select: this.userSelect() },
      order: { select: { id: true, status: true, paymentStatus: true } },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: {
          id: true,
          message: true,
          senderType: true,
          createdAt: true,
          attachments: { select: this.attachmentSelect() },
        },
      },
    } satisfies Prisma.SupportTicketInclude;
  }

  private ticketDetailsInclude() {
    return {
      customer: { select: this.userSelect() },
      assignedTo: { select: this.userSelect() },
      order: { select: { id: true, status: true, paymentStatus: true } },
      messages: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          sender: { select: this.userSelect() },
          attachments: { select: this.attachmentSelect() },
        },
      },
      assignmentHistory: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          previousAssignee: { select: this.userSelect() },
          newAssignee: { select: this.userSelect() },
          assignedBy: { select: this.userSelect() },
        },
      },
    } satisfies Prisma.SupportTicketInclude;
  }

  private userSelect() {
    return {
      id: true,
      email: true,
      fullName: true,
      role: true,
    } as const;
  }

  private attachmentSelect() {
    return {
      id: true,
      originalName: true,
      mimeType: true,
      size: true,
      createdAt: true,
    } as const;
  }

  private assertAdmin(user: AuthUser) {
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('Only admins can manage support tickets');
    }
  }

  private isAdmin(user: AuthUser) {
    return ['admin', 'superadmin'].includes(user.role);
  }
}
