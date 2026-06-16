import { PriceUnit } from '@prisma/client';
import { WishlistsService } from './wishlists.service';

describe('WishlistsService', () => {
  const user = {
    id: 'user-id',
    email: 'customer@example.com',
    fullName: 'Customer',
    role: 'user',
    authProviders: ['password'],
    emailVerified: true,
  };
  const wishlist = {
    id: 'wishlist-id',
    userId: user.id,
    name: 'Monthly Groceries',
    orderId: null,
    convertedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: null,
    items: [
      {
        id: 'item-id',
        wishlistId: 'wishlist-id',
        productId: 'product-id',
        quantity: 1,
        unit: PriceUnit.bag,
        createdAt: new Date(),
        updatedAt: new Date(),
        product: {
          id: 'product-id',
          name: 'Rice',
        },
      },
    ],
  };

  it('creates a JWT-owned wishlist with its requested items', async () => {
    const create = jest.fn(() => Promise.resolve(wishlist));
    const service = new WishlistsService(
      {
        product: { count: jest.fn().mockResolvedValue(1) },
        wishlist: { create },
      } as never,
      {} as never,
    );

    await service.create(user.id, {
      name: ' Monthly Groceries ',
      items: [
        {
          productId: 'product-id',
          quantity: 1,
          unit: PriceUnit.bag,
        },
      ],
    });

    const call = create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    expect(call.data).toEqual(
      expect.objectContaining({
        userId: user.id,
        name: 'Monthly Groceries',
        items: {
          create: [
            {
              productId: 'product-id',
              quantity: 1,
              unit: PriceUnit.bag,
            },
          ],
        },
      }),
    );
  });

  it('returns descriptive unavailable-unit results without quoting an order', async () => {
    const orderQuote = jest.fn();
    const service = new WishlistsService(
      {
        wishlist: { findFirst: jest.fn().mockResolvedValue(wishlist) },
        buyPrice: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'rice-derica-price',
              productId: 'product-id',
              unit: PriceUnit.derica,
              finalPrice: 2500,
              product: wishlist.items[0].product,
            },
          ]),
        },
      } as never,
      { quote: orderQuote } as never,
    );

    const result = await service.quote(user, wishlist.id, {});

    expect(result).toEqual(
      expect.objectContaining({
        canProceed: false,
        summary: {
          received: 1,
          matched: 0,
          requiresAttention: 1,
        },
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'unavailable',
        availableUnits: [PriceUnit.derica],
      }),
    );
    expect(orderQuote).not.toHaveBeenCalled();
  });

  it('converts current active prices through the existing order flow', async () => {
    const orderResult = {
      order: { id: 'order-id' },
      payment: {
        reference: 'order_order-id',
        status: 'pending',
        paymentAction: 'none',
      },
    };
    const orderCreate = jest.fn().mockResolvedValue(orderResult);
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(wishlist)
      .mockResolvedValueOnce({
        ...wishlist,
        orderId: 'order-id',
        convertedAt: new Date(),
        order: {
          id: 'order-id',
          status: 'pending',
          paymentStatus: 'pending',
        },
      });
    const service = new WishlistsService(
      {
        wishlist: {
          findFirst,
        },
        buyPrice: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'rice-bag-price',
              productId: 'product-id',
              unit: PriceUnit.bag,
              finalPrice: 55200,
              product: wishlist.items[0].product,
            },
          ]),
        },
      } as never,
      { create: orderCreate } as never,
    );

    const result = await service.convert(user, wishlist.id, {
      note: 'Call before delivery',
    });

    expect(orderCreate).toHaveBeenCalledWith(
      {
        items: [{ buyPriceId: 'rice-bag-price', quantity: 1 }],
        couponCode: undefined,
        deliveryAddress: undefined,
        note: 'Call before delivery',
      },
      user,
      { wishlistId: wishlist.id },
    );
    expect(result).toEqual(
      expect.objectContaining({
        order: orderResult.order,
        payment: orderResult.payment,
      }),
    );
  });
});
