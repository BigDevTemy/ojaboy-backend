import { WishlistsService } from './wishlists.service';

const bagUnit = {
  id: 'bag-unit-id',
  code: 'bag',
  label: 'Bag',
  aliases: ['bags'],
  packageType: 'bag',
  sortOrder: 3,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const dericaUnit = {
  id: 'derica-unit-id',
  code: 'derica',
  label: 'Derica',
  aliases: ['dericas'],
  packageType: null,
  sortOrder: 17,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const priceUnitsService = {
  requireByCode: jest.fn((code: string) =>
    Promise.resolve(code === 'derica' ? dericaUnit : bagUnit),
  ),
};

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
        priceUnitId: bagUnit.id,
        priceUnit: bagUnit,
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
    const create = jest.fn((_args?: unknown) => Promise.resolve(wishlist));
    const service = new WishlistsService(
      {
        product: { count: jest.fn().mockResolvedValue(1) },
        wishlist: { create },
      } as never,
      {} as never,
      priceUnitsService as never,
    );

    await service.create(user.id, {
      name: ' Monthly Groceries ',
      items: [
        {
          productId: 'product-id',
          quantity: 1,
          unit: 'bag',
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
              priceUnitId: bagUnit.id,
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
              priceUnitId: dericaUnit.id,
              priceUnit: dericaUnit,
              finalPrice: 2500,
              product: wishlist.items[0].product,
            },
          ]),
        },
      } as never,
      { quote: orderQuote } as never,
      priceUnitsService as never,
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
        availableUnits: [dericaUnit.code],
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
              priceUnitId: bagUnit.id,
              priceUnit: bagUnit,
              finalPrice: 55200,
              product: wishlist.items[0].product,
            },
          ]),
        },
      } as never,
      { create: orderCreate } as never,
      priceUnitsService as never,
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

  it('adds an exact product offering to a wishlist', async () => {
    const offeringId = '22222222-2222-4222-8222-222222222222';
    const create = jest.fn().mockResolvedValue({ id: 'item-id' });
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(wishlist)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(wishlist);
    const service = new WishlistsService(
      {
        wishlist: { findFirst },
        product: { count: jest.fn().mockResolvedValue(1) },
        productOffering: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: offeringId, productId: 'product-id' }]),
        },
        wishlistItem: { findFirst, create },
      } as never,
      {} as never,
      priceUnitsService as never,
    );

    await service.addItem(user.id, wishlist.id, {
      productId: 'product-id',
      productOfferingId: offeringId,
      quantity: 1,
      unit: 'bag',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        wishlistId: wishlist.id,
        productId: 'product-id',
        productOfferingId: offeringId,
        quantity: 1,
        priceUnitId: bagUnit.id,
      },
    });
  });

  it('rejects an offering that belongs to another product', async () => {
    const service = new WishlistsService(
      {
        wishlist: { findFirst: jest.fn().mockResolvedValue(wishlist) },
        product: { count: jest.fn().mockResolvedValue(1) },
        productOffering: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: '22222222-2222-4222-8222-222222222222',
              productId: 'different-product',
            },
          ]),
        },
      } as never,
      {} as never,
      priceUnitsService as never,
    );

    await expect(
      service.addItem(user.id, wishlist.id, {
        productId: 'product-id',
        productOfferingId: '22222222-2222-4222-8222-222222222222',
        quantity: 1,
        unit: 'bag',
      }),
    ).rejects.toThrow(
      'Product offering does not belong to the selected product',
    );
  });

  it('quotes an exact wishlist offering using only its matching buy price', async () => {
    const offeringId = '22222222-2222-4222-8222-222222222222';
    const exactWishlist = {
      ...wishlist,
      items: [
        {
          ...wishlist.items[0],
          productOfferingId: offeringId,
          productOffering: {
            id: offeringId,
            sku: 'RICE-MYCHOICE-50KG',
            variant: { id: 'variant-id', name: 'Special Rice' },
            brand: { id: 'brand-id', name: 'My Choice' },
            package: { id: 'package-id', name: '50 kg bag' },
          },
        },
      ],
    };
    const orderQuote = jest.fn().mockResolvedValue({ quote: { total: 85000 } });
    const service = new WishlistsService(
      {
        wishlist: { findFirst: jest.fn().mockResolvedValue(exactWishlist) },
        buyPrice: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'exact-price',
              productId: 'product-id',
              productOfferingId: offeringId,
              priceUnitId: bagUnit.id,
              priceUnit: bagUnit,
              finalPrice: 85000,
              product: wishlist.items[0].product,
              productOffering: exactWishlist.items[0].productOffering,
            },
            {
              id: 'other-price',
              productId: 'product-id',
              productOfferingId: 'other-offering',
              priceUnitId: bagUnit.id,
              priceUnit: bagUnit,
              finalPrice: 70000,
              product: wishlist.items[0].product,
              productOffering: {
                id: 'other-offering',
                sku: 'RICE-LOCAL-50KG',
                variant: { id: 'local', name: 'Local Rice' },
                brand: null,
                package: { id: 'package-id', name: '50 kg bag' },
              },
            },
          ]),
        },
      } as never,
      { quote: orderQuote } as never,
      priceUnitsService as never,
    );

    const result = await service.quote(user, wishlist.id, {});

    expect(result.canProceed).toBe(true);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched',
        productOfferingId: offeringId,
        buyPriceId: 'exact-price',
        brandName: 'My Choice',
        packageName: '50 kg bag',
      }),
    );
    expect(orderQuote).toHaveBeenCalledWith(
      {
        items: [{ buyPriceId: 'exact-price', quantity: 1 }],
        couponCode: undefined,
        deliveryAddress: undefined,
      },
      user,
    );
  });

  it('returns confirmation choices for an ambiguous legacy wishlist item', async () => {
    const orderQuote = jest.fn();
    const service = new WishlistsService(
      {
        wishlist: { findFirst: jest.fn().mockResolvedValue(wishlist) },
        buyPrice: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'local-rice-price',
              productId: 'product-id',
              productOfferingId: 'local-rice',
              priceUnitId: bagUnit.id,
              priceUnit: bagUnit,
              finalPrice: 70000,
              product: wishlist.items[0].product,
              productOffering: {
                id: 'local-rice',
                sku: 'RICE-LOCAL-50KG',
                variant: { id: 'local', name: 'Local Rice' },
                brand: null,
                package: { id: 'package-id', name: '50 kg bag' },
              },
            },
            {
              id: 'special-rice-price',
              productId: 'product-id',
              productOfferingId: 'special-rice',
              priceUnitId: bagUnit.id,
              priceUnit: bagUnit,
              finalPrice: 85000,
              product: wishlist.items[0].product,
              productOffering: {
                id: 'special-rice',
                sku: 'RICE-SPECIAL-50KG',
                variant: { id: 'special', name: 'Special Rice' },
                brand: { id: 'brand-id', name: 'My Choice' },
                package: { id: 'package-id', name: '50 kg bag' },
              },
            },
          ]),
        },
      } as never,
      { quote: orderQuote } as never,
      priceUnitsService as never,
    );

    const result = await service.quote(user, wishlist.id, {});

    expect(result.canProceed).toBe(false);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'needs_confirmation',
        choices: expect.arrayContaining([
          expect.objectContaining({ productOfferingId: 'local-rice' }),
          expect.objectContaining({ productOfferingId: 'special-rice' }),
        ]),
      }),
    );
    expect(orderQuote).not.toHaveBeenCalled();
  });
});
