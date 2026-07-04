import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const admin = { id: 'admin-id', role: 'admin' } as never;
  const customer = { id: 'user-id', role: 'user' } as never;

  it('rejects non-admins from listing customer accounts', async () => {
    const findMany = jest.fn();
    const prisma = { user: { findMany, count: jest.fn() } };
    const service = new UsersService(prisma as never);

    await expect(
      service.findAll(customer, { page: 1, limit: 50 }),
    ).rejects.toThrow(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('defaults to role=user, paginates, and flattens the order count', async () => {
    const findMany = jest
      .fn<
        Promise<{ id: string; _count: { orders: number } }[]>,
        [Record<string, unknown>]
      >()
      .mockResolvedValue([
        { id: 'user-1', _count: { orders: 4 } },
        { id: 'user-2', _count: { orders: 0 } },
      ]);
    const count = jest
      .fn<Promise<number>, [Record<string, unknown>]>()
      .mockResolvedValue(2);
    const prisma = { user: { findMany, count } };
    const service = new UsersService(prisma as never);

    const result = await service.findAll(admin, { page: 1, limit: 50 });

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { role: 'user' },
      skip: 0,
      take: 50,
    });
    expect(result.data).toEqual([
      { id: 'user-1', orderCount: 4 },
      { id: 'user-2', orderCount: 0 },
    ]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 2,
      totalPages: 1,
    });
  });

  it('searches by fullName/email when a search term is given', async () => {
    const findMany = jest
      .fn<Promise<never[]>, [Record<string, unknown>]>()
      .mockResolvedValue([]);
    const count = jest
      .fn<Promise<number>, [Record<string, unknown>]>()
      .mockResolvedValue(0);
    const prisma = { user: { findMany, count } };
    const service = new UsersService(prisma as never);

    await service.findAll(admin, { page: 1, limit: 50, search: 'ade' });

    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        role: 'user',
        OR: [
          { fullName: { contains: 'ade', mode: 'insensitive' } },
          { email: { contains: 'ade', mode: 'insensitive' } },
        ],
      },
    });
  });
});
