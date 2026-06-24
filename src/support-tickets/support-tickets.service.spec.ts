import {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketSenderType,
  SupportTicketStatus,
} from '@prisma/client';
import { SupportTicketsService } from './support-tickets.service';

describe('SupportTicketsService', () => {
  const customer = {
    id: 'customer-id',
    email: 'customer@example.com',
    fullName: 'Customer',
    role: 'user',
    authProviders: ['password'],
    emailVerified: true,
  };

  it('assigns a new ticket to the least-loaded admin atomically', async () => {
    const createdTicket = {
      id: 'ticket-id',
      ticketNumber: 'SUP-1000',
      assignedToId: 'admin-two',
    };
    const create = jest.fn(
      (input: {
        data: {
          ticketNumber: string;
          customerId: string;
          assignedToId: string;
        };
      }) => {
        void input;
        return Promise.resolve(createdTicket);
      },
    );
    const executeRaw = jest.fn().mockResolvedValue(1);
    const queryRaw = jest.fn().mockResolvedValue([{ value: 1000n }]);
    const tx = {
      $executeRawUnsafe: executeRaw,
      $queryRawUnsafe: queryRaw,
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'admin-one',
            email: 'one@example.com',
            fullName: 'Admin One',
            role: 'admin',
            _count: { assignedSupportTickets: 3 },
            assignedSupportTickets: [{ assignedAt: new Date('2026-06-24') }],
          },
          {
            id: 'admin-two',
            email: 'two@example.com',
            fullName: 'Admin Two',
            role: 'admin',
            _count: { assignedSupportTickets: 1 },
            assignedSupportTickets: [{ assignedAt: new Date('2026-06-23') }],
          },
        ]),
      },
      supportTicket: { create },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new SupportTicketsService(prisma as never);

    const result = await service.create(customer, {
      subject: 'Refund confirmation',
      category: SupportTicketCategory.refund_and_payment,
      priority: SupportTicketPriority.high,
      message: 'Please confirm my refund.',
    });

    expect(executeRaw).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext('support-ticket-assignment'))",
    );
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        ticketNumber: 'SUP-1000',
        customerId: customer.id,
        assignedToId: 'admin-two',
        priority: SupportTicketPriority.high,
      }),
    );
    expect(result.ticket).toBe(createdTicket);
  });

  it('does not create an unattended ticket when no admin exists', async () => {
    const create = jest.fn();
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      user: { findMany: jest.fn().mockResolvedValue([]) },
      supportTicket: { create },
    };
    const prisma = {
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new SupportTicketsService(prisma as never);

    await expect(
      service.create(customer, {
        subject: 'Delivery issue',
        category: SupportTicketCategory.delivery,
        priority: SupportTicketPriority.normal,
        message: 'My delivery has not arrived.',
      }),
    ).rejects.toThrow(
      'No admin staff is available to receive this support ticket',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('counts waiting tickets as both active and needing a reply', async () => {
    const service = new SupportTicketsService({
      supportTicket: {
        groupBy: jest.fn().mockResolvedValue([
          {
            status: SupportTicketStatus.open,
            _count: { _all: 2 },
          },
          {
            status: SupportTicketStatus.waiting_on_customer,
            _count: { _all: 1 },
          },
          {
            status: SupportTicketStatus.resolved,
            _count: { _all: 4 },
          },
        ]),
      },
    } as never);

    await expect(service.getMySummary(customer.id)).resolves.toEqual({
      activeCases: 3,
      needsYourReply: 1,
      resolved: 4,
      total: 7,
      byStatus: {
        open: 2,
        in_review: 0,
        waiting_on_customer: 1,
        resolved: 4,
      },
    });
  });

  it('paginates tickets assigned to the authenticated admin only', async () => {
    const findMany = jest.fn(
      (input: {
        where: {
          assignedToId?: string;
          status?: SupportTicketStatus;
        };
        skip: number;
        take: number;
      }) => {
        void input;
        return [];
      },
    );
    const count = jest.fn().mockReturnValue(0);
    const prisma = {
      supportTicket: { findMany, count },
      $transaction: jest.fn((queries: unknown[]) => Promise.resolve(queries)),
    };
    const service = new SupportTicketsService(prisma as never);
    const admin = {
      ...customer,
      id: 'admin-id',
      role: 'admin',
    };

    await expect(
      service.findAssignedToMe(admin, {
        page: 2,
        limit: 10,
        status: SupportTicketStatus.in_review,
        priority: SupportTicketPriority.urgent,
        assignedToId: 'different-admin-id',
      }),
    ).resolves.toEqual({
      data: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });

    const query = findMany.mock.calls[0][0];
    expect(query.where.assignedToId).toBe(admin.id);
    expect(query.where.status).toBe(SupportTicketStatus.in_review);
    expect(query.where.priority).toBe(SupportTicketPriority.urgent);
    expect(query.skip).toBe(10);
    expect(query.take).toBe(10);
  });

  it('moves a ticket to waiting_on_customer when staff replies', async () => {
    const update = jest.fn(
      (input: {
        data: {
          status: SupportTicketStatus;
          resolvedAt: Date | null;
        };
      }) => Promise.resolve(input),
    );
    const tx = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          ticketNumber: 'SUP-1000',
          customerId: customer.id,
          assignedToId: 'admin-id',
          status: SupportTicketStatus.in_review,
        }),
        update,
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'message-id',
          senderType: SupportTicketSenderType.staff,
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SupportTicketsService({
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never);
    const admin = { ...customer, id: 'admin-id', role: 'admin' };

    const result = await service.addMessage(admin, 'ticket-id', {
      message: 'Please provide the requested information.',
      status: SupportTicketStatus.waiting_on_customer,
    });

    expect(update.mock.calls[0][0].data.status).toBe(
      SupportTicketStatus.waiting_on_customer,
    );
    expect(update.mock.calls[0][0].data.resolvedAt).toBeNull();
    expect(result.status).toBe(SupportTicketStatus.waiting_on_customer);
  });

  it('keeps the current status when staff replies without a status', async () => {
    const update = jest.fn(
      (input: {
        data: {
          status: SupportTicketStatus;
          resolvedAt: Date | null;
        };
      }) => Promise.resolve(input),
    );
    const tx = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          ticketNumber: 'SUP-1000',
          customerId: customer.id,
          assignedToId: 'admin-id',
          status: SupportTicketStatus.in_review,
        }),
        update,
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'message-id',
          senderType: SupportTicketSenderType.staff,
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SupportTicketsService({
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never);
    const admin = { ...customer, id: 'admin-id', role: 'admin' };

    const result = await service.addMessage(admin, 'ticket-id', {
      message: 'We are still investigating this issue.',
    });

    expect(update.mock.calls[0][0].data.status).toBe(
      SupportTicketStatus.in_review,
    );
    expect(result.status).toBe(SupportTicketStatus.in_review);
  });

  it('resolves a ticket when staff replies with resolved status', async () => {
    const update = jest.fn(
      (input: {
        data: {
          status: SupportTicketStatus;
          resolvedAt: Date | null;
        };
      }) => Promise.resolve(input),
    );
    const tx = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          ticketNumber: 'SUP-1000',
          customerId: customer.id,
          assignedToId: 'admin-id',
          status: SupportTicketStatus.in_review,
        }),
        update,
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'message-id',
          senderType: SupportTicketSenderType.staff,
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SupportTicketsService({
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never);
    const admin = { ...customer, id: 'admin-id', role: 'admin' };

    const result = await service.addMessage(admin, 'ticket-id', {
      message: 'Your issue has been resolved.',
      status: SupportTicketStatus.resolved,
    });

    expect(update.mock.calls[0][0].data.status).toBe(
      SupportTicketStatus.resolved,
    );
    expect(update.mock.calls[0][0].data.resolvedAt).toEqual(expect.any(Date));
    expect(result.status).toBe(SupportTicketStatus.resolved);
  });

  it('moves a ticket to in_review when the customer replies', async () => {
    const update = jest.fn(
      (input: {
        data: {
          status: SupportTicketStatus;
          resolvedAt: Date | null;
        };
      }) => Promise.resolve(input),
    );
    const tx = {
      supportTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket-id',
          ticketNumber: 'SUP-1000',
          customerId: customer.id,
          assignedToId: 'admin-id',
          status: SupportTicketStatus.waiting_on_customer,
        }),
        update,
      },
      supportTicketMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'message-id',
          senderType: SupportTicketSenderType.customer,
        }),
      },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new SupportTicketsService({
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as never);

    const result = await service.addMessage(customer, 'ticket-id', {
      message: 'Here is the requested information.',
    });

    expect(update.mock.calls[0][0].data.status).toBe(
      SupportTicketStatus.in_review,
    );
    expect(update.mock.calls[0][0].data.resolvedAt).toBeNull();
    expect(result.status).toBe(SupportTicketStatus.in_review);
  });
});
