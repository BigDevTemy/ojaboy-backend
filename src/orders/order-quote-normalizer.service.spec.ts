import { PriceUnitLookup } from '../price-units/price-unit-lookup';
import { OrderQuoteNormalizerService } from './order-quote-normalizer.service';

describe('OrderQuoteNormalizerService', () => {
  const catalog = [
    {
      id: 'palm-oil-bottle',
      productId: 'palm-oil',
      priceUnit: { code: 'bottle' },
      finalPrice: 4000,
      product: { id: 'palm-oil', name: 'Palm Oil' },
    },
    {
      id: 'garri-basket',
      productId: 'garri',
      priceUnit: { code: 'basket' },
      finalPrice: 20000,
      product: { id: 'garri', name: 'Garri' },
    },
    {
      id: 'rice-derica',
      productId: 'rice',
      priceUnit: { code: 'derica' },
      finalPrice: 2500,
      product: { id: 'rice', name: 'Rice' },
    },
    {
      id: 'onions-bowl',
      productId: 'onions',
      priceUnit: { code: 'bowl' },
      finalPrice: 800,
      product: { id: 'onions', name: 'Onions' },
    },
    {
      id: 'beans-bag',
      productId: 'beans',
      priceUnit: { code: 'bag' },
      finalPrice: 60000,
      product: { id: 'beans', name: 'Beans' },
    },
  ];

  const activeProducts = [
    { id: 'palm-oil', name: 'Palm Oil' },
    { id: 'garri', name: 'Garri' },
    { id: 'rice', name: 'Rice' },
    { id: 'tomatoes', name: 'Tomatoes' },
    { id: 'onions', name: 'Onions' },
    { id: 'beans', name: 'Beans' },
  ];

  // Mirrors the real price_units table (code + aliases), not the old
  // hardcoded UNIT_ALIASES map - proves unit resolution now comes from the
  // same source of truth as the rest of the app.
  const priceUnitLookup = new PriceUnitLookup(
    [
      { code: 'bottle', aliases: ['bottles'] },
      { code: 'basket', aliases: ['baskets'] },
      { code: 'derica', aliases: ['dericas'] },
      { code: 'bag', aliases: ['bags'] },
      { code: 'cup', aliases: ['cups'] },
      { code: 'kilo', aliases: ['kilos', 'kg', 'kgs', 'kilogram', 'kilograms'] },
      { code: 'bowl', aliases: ['bowls'] },
      {
        code: 'paint',
        aliases: ['paint bucket', 'paint buckets', 'paint rubber', 'paint rubbers'],
      },
      { code: 'crate', aliases: ['crates'] },
      { code: 'litre', aliases: ['litres', 'liter', 'liters', 'l'] },
      { code: 'bunch', aliases: ['bunches'] },
      { code: 'piece', aliases: ['pieces', 'pcs', 'pc'] },
    ].map((unit, index) => ({
      id: `unit-${unit.code}`,
      code: unit.code,
      label: unit.code,
      aliases: unit.aliases,
      packageType: null,
      sortOrder: index,
      isActive: true,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    })) as never,
  );
  const priceUnitsService = {
    getLookup: jest.fn().mockResolvedValue(priceUnitLookup),
  };

  const createService = (products: unknown[] = activeProducts) =>
    new OrderQuoteNormalizerService(
      {
        buyPrice: {
          findMany: jest.fn().mockResolvedValue(catalog),
        },
        product: {
          findMany: jest.fn().mockResolvedValue(products),
        },
      } as never,
      priceUnitsService as never,
    );

  it('normalizes number words and an obvious unit typo', async () => {
    const result = await createService().normalize(
      '1 bottler palm oil, two derica of rice',
    );

    expect(result.canProceed).toBe(true);
    expect(result.quoteItems).toEqual([
      { buyPriceId: 'palm-oil-bottle', quantity: 1 },
      { buyPriceId: 'rice-derica', quantity: 2 },
    ]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched',
        interpretation: {
          product: 'Palm Oil',
          quantity: 1,
          unit: 'bottle',
        },
      }),
    );
  });

  it('prices one quarter from the full basket buy price', async () => {
    const result = await createService().normalize('1/4 basket of garri');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched',
        unitPrice: 20000,
        totalPrice: 5000,
        interpretation: {
          product: 'Garri',
          quantity: 0.25,
          unit: 'basket',
        },
      }),
    );
  });

  it('returns the product units when the requested unit is unavailable', async () => {
    const result = await createService().normalize('a cup of garri');

    expect(result.canProceed).toBe(false);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'unsupported_unit',
        availableUnits: ['basket'],
        interpretation: {
          product: 'Garri',
          quantity: 1,
          unit: 'cup',
        },
      }),
    );
    expect(result.items[0].message).toContain('Available units are basket');
  });

  it('recognizes units that the old hardcoded alias list did not know', async () => {
    const result = await createService().normalize('1 bowl of onions');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched',
        buyPriceId: 'onions-bowl',
        unitPrice: 800,
        totalPrice: 800,
        interpretation: {
          product: 'Onions',
          quantity: 1,
          unit: 'bowl',
        },
      }),
    );
  });

  it('reports an unsupported unit instead of silently treating it as an amount', async () => {
    // "kilo" is a real price unit but rice is only priced by derica here -
    // this must come back as unsupported_unit, not fall through to
    // amount-mode just because rice has no kilo-priced offering.
    const result = await createService().normalize('1 kilo of rice');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'unsupported_unit',
        availableUnits: ['derica'],
        interpretation: {
          product: 'Rice',
          quantity: 1,
          unit: 'kilo',
        },
      }),
    );
  });

  it('flags a completely unrecognized unit word instead of pricing it as a Naira amount', async () => {
    // "kobiowu" isn't in price_units at all (unlike "kilo" above, which is
    // a real unit just not offered for rice) - this must not fall through
    // to amount-mode and silently price it as N1 worth of rice.
    const result = await createService().normalize('1 kobiowu of rice');

    expect(result.canProceed).toBe(false);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'unsupported_unit',
        availableUnits: ['derica'],
        interpretation: {
          product: 'Rice',
          quantity: 1,
          unit: 'kobiowu',
        },
      }),
    );
    expect(result.items[0].message).toContain('Available units are derica');
    // The frontend needs a buyPriceId to call resolve-item once the
    // customer picks a unit - availableUnits alone (bare strings) isn't
    // enough for that.
    expect(result.items[0].choices).toEqual([
      expect.objectContaining({ buyPriceId: 'rice-derica', unit: 'derica' }),
    ]);
  });

  it('includes choices (with buyPriceId) for a recognized unit the product does not offer', async () => {
    const result = await createService().normalize('1 kilo of rice');

    expect(result.items[0].choices).toEqual([
      expect.objectContaining({ buyPriceId: 'rice-derica', unit: 'derica' }),
    ]);
  });

  it('flags an unrecognized unit word even without the word "of"', async () => {
    const result = await createService().normalize('1 kobiowu rice');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'unsupported_unit',
        availableUnits: ['derica'],
        interpretation: {
          product: 'Rice',
          quantity: 1,
          unit: 'kobiowu',
        },
      }),
    );
  });

  it('handles a mixed list with an unrecognized unit alongside working lines', async () => {
    const result = await createService().normalize(
      '1 kobiowu of rice,1 bag beans,2000 tomatoes',
    );

    expect(result.summary).toEqual({
      received: 3,
      matched: 2,
      requiresAttention: 1,
    });
    expect(result.items.map((item) => item.status)).toEqual([
      'unsupported_unit',
      'matched',
      'matched_amount',
    ]);
    expect(result.quoteItems).toEqual([
      { buyPriceId: 'beans-bag', quantity: 1 },
      { productId: 'tomatoes', amount: 2000 },
    ]);
  });

  it('rejects fractions other than one half and one quarter', async () => {
    const result = await createService().normalize('1/3 basket garri');

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'invalid_quantity',
        message:
          'The fraction 1/3 is not supported. Only 1/2 and 1/4 are allowed.',
      }),
    );
  });

  it('resolves an explicit Naira amount line without pricing it', async () => {
    const result = await createService().normalize('N2000 tommatoes');

    expect(result.canProceed).toBe(true);
    expect(result.quoteItems).toEqual([{ productId: 'tomatoes', amount: 2000 }]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched_amount',
        productId: 'tomatoes',
        totalPrice: 2000,
        interpretation: {
          product: 'Tomatoes',
          amount: 2000,
        },
      }),
    );
  });

  it('treats a bare number with no recognizable unit as a Naira amount', async () => {
    const result = await createService().normalize('400 onions');

    expect(result.canProceed).toBe(true);
    expect(result.quoteItems).toEqual([{ productId: 'onions', amount: 400 }]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched_amount',
        productId: 'onions',
        totalPrice: 400,
      }),
    );
  });

  it('mixes amount-based and quantity-based lines in one order', async () => {
    const result = await createService().normalize(
      'N2000 tommatoes,400 onions,1 basket garri',
    );

    expect(result.canProceed).toBe(true);
    expect(result.quoteItems).toEqual([
      { productId: 'tomatoes', amount: 2000 },
      { productId: 'onions', amount: 400 },
      { buyPriceId: 'garri-basket', quantity: 1 },
    ]);
    expect(result.items.map((item) => item.status)).toEqual([
      'matched_amount',
      'matched_amount',
      'matched',
    ]);
  });

  it('keeps matched lines when another line requires attention', async () => {
    const result = await createService().normalize(
      '1/2 basket garri, 1 cup rice',
    );

    expect(result.summary).toEqual({
      received: 2,
      matched: 1,
      requiresAttention: 1,
    });
    expect(result.quoteItems).toEqual([
      { buyPriceId: 'garri-basket', quantity: 0.5 },
    ]);
    expect(result.items.map((item) => item.status)).toEqual([
      'matched',
      'unsupported_unit',
    ]);
  });

  it('returns offering choices instead of silently selecting an ambiguous bag', async () => {
    const riceOfferings = [
      {
        id: 'local-rice-50kg',
        productId: 'rice',
        productOfferingId: 'local-rice-offering',
        priceUnit: { code: 'bag' },
        finalPrice: 70000,
        product: { id: 'rice', name: 'Rice' },
        productOffering: {
          id: 'local-rice-offering',
          sku: 'RICE-LOCAL-50KG',
          variant: { id: 'local', name: 'Local Rice' },
          brand: null,
          package: { id: '50kg', name: '50 kg bag' },
        },
      },
      {
        id: 'special-rice-50kg',
        productId: 'rice',
        productOfferingId: 'special-rice-offering',
        priceUnit: { code: 'bag' },
        finalPrice: 85000,
        product: { id: 'rice', name: 'Rice' },
        productOffering: {
          id: 'special-rice-offering',
          sku: 'RICE-MYCHOICE-SPECIAL-50KG',
          variant: { id: 'special', name: 'Special Rice' },
          brand: { id: 'my-choice', name: 'My Choice' },
          package: { id: '50kg', name: '50 kg bag' },
        },
      },
    ];
    const service = new OrderQuoteNormalizerService({
      buyPrice: {
        findMany: jest.fn().mockResolvedValue(riceOfferings),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'rice', name: 'Rice' }]),
      },
    } as never, priceUnitsService as never);

    const result = await service.normalize('two bags of rice');

    expect(result.canProceed).toBe(false);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'needs_confirmation',
        choices: [
          expect.objectContaining({
            buyPriceId: 'local-rice-50kg',
            productOfferingId: 'local-rice-offering',
            label: 'Local Rice — Rice — 50 kg bag',
          }),
          expect.objectContaining({
            buyPriceId: 'special-rice-50kg',
            productOfferingId: 'special-rice-offering',
            label: 'My Choice — Special Rice — Rice — 50 kg bag',
          }),
        ],
      }),
    );
    expect(result.quoteItems).toEqual([]);
  });

  it('resolves a sufficiently detailed brand and variant request', async () => {
    const riceOfferings = [
      {
        id: 'local-rice-50kg',
        productId: 'rice',
        productOfferingId: 'local-rice-offering',
        priceUnit: { code: 'bag' },
        finalPrice: 70000,
        product: { id: 'rice', name: 'Rice' },
        productOffering: {
          id: 'local-rice-offering',
          sku: 'RICE-LOCAL-50KG',
          variant: { id: 'local', name: 'Local Rice' },
          brand: null,
          package: { id: '50kg', name: '50 kg bag' },
        },
      },
      {
        id: 'special-rice-50kg',
        productId: 'rice',
        productOfferingId: 'special-rice-offering',
        priceUnit: { code: 'bag' },
        finalPrice: 85000,
        product: { id: 'rice', name: 'Rice' },
        productOffering: {
          id: 'special-rice-offering',
          sku: 'RICE-MYCHOICE-SPECIAL-50KG',
          variant: { id: 'special', name: 'Special Rice' },
          brand: { id: 'my-choice', name: 'My Choice' },
          package: { id: '50kg', name: '50 kg bag' },
        },
      },
    ];
    const service = new OrderQuoteNormalizerService({
      buyPrice: {
        findMany: jest.fn().mockResolvedValue(riceOfferings),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'rice', name: 'Rice' }]),
      },
    } as never, priceUnitsService as never);

    const result = await service.normalize(
      'two bags of My Choice Special Rice',
    );

    expect(result.canProceed).toBe(true);
    expect(result.quoteItems).toEqual([
      { buyPriceId: 'special-rice-50kg', quantity: 2 },
    ]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        status: 'matched',
        buyPriceId: 'special-rice-50kg',
        unitPrice: 85000,
        totalPrice: 170000,
      }),
    );
  });

  it('uses a stated package size to resolve offerings sharing a brand and variant', async () => {
    const service = new OrderQuoteNormalizerService({
      buyPrice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'special-rice-25kg',
            productId: 'rice',
            productOfferingId: 'special-rice-25kg-offering',
            priceUnit: { code: 'bag' },
            finalPrice: 45000,
            product: { id: 'rice', name: 'Rice' },
            productOffering: {
              id: 'special-rice-25kg-offering',
              sku: 'RICE-MYCHOICE-SPECIAL-25KG',
              variant: { id: 'special', name: 'Special Rice' },
              brand: { id: 'my-choice', name: 'My Choice' },
              package: { id: '25kg', name: '25 kg bag' },
            },
          },
          {
            id: 'special-rice-50kg',
            productId: 'rice',
            productOfferingId: 'special-rice-50kg-offering',
            priceUnit: { code: 'bag' },
            finalPrice: 85000,
            product: { id: 'rice', name: 'Rice' },
            productOffering: {
              id: 'special-rice-50kg-offering',
              sku: 'RICE-MYCHOICE-SPECIAL-50KG',
              variant: { id: 'special', name: 'Special Rice' },
              brand: { id: 'my-choice', name: 'My Choice' },
              package: { id: '50kg', name: '50 kg bag' },
            },
          },
        ]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'rice', name: 'Rice' }]),
      },
    } as never, priceUnitsService as never);

    const result = await service.normalize(
      'two 50 kg bags of My Choice Special Rice',
    );

    expect(result.canProceed).toBe(true);
    expect(result.quoteItems).toEqual([
      { buyPriceId: 'special-rice-50kg', quantity: 2 },
    ]);
  });

  it('does not filter the catalog by validUntil, since prices are only regenerated when they change', async () => {
    const findMany = jest.fn().mockResolvedValue(catalog);
    const service = new OrderQuoteNormalizerService(
      {
        buyPrice: { findMany },
        product: { findMany: jest.fn().mockResolvedValue(activeProducts) },
      } as never,
      priceUnitsService as never,
    );

    await service.normalize('1 bowl of onions');

    const where = findMany.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('validUntil');
    expect(where).not.toHaveProperty('OR');
    expect(where).toMatchObject({ isActive: true });
  });

  describe('resolveChoice', () => {
    const buyPrice = {
      id: 'rice-aroso-paint',
      productId: 'rice',
      isActive: true,
      validFrom: new Date('2026-06-01T00:00:00.000Z'),
      validUntil: null,
      finalPrice: 4200,
      priceUnitId: 'unit-paint',
      priceUnit: { code: 'paint' },
      product: { id: 'rice', name: 'Rice', status: 'active' },
      productOffering: {
        id: 'a9a223a8-2730-4789-b9b0-24517e60ac26',
        sku: 'RICE-AROSO-PAINT',
        variant: { id: 'aroso', name: 'Aroso' },
        brand: null,
        package: { id: 'paint', name: 'Paint' },
      },
    };

    it('resolves a chosen buyPriceId into a matched item without touching the rest of the order', async () => {
      const findUnique = jest.fn().mockResolvedValue(buyPrice);
      const service = new OrderQuoteNormalizerService(
        { buyPrice: { findUnique } } as never,
        priceUnitsService as never,
      );

      const result = await service.resolveChoice({
        buyPriceId: 'rice-aroso-paint',
        quantity: 2,
        original: '1 paint rice',
      });

      expect(findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rice-aroso-paint' } }),
      );
      expect(result).toMatchObject({
        original: '1 paint rice',
        status: 'matched',
        buyPriceId: 'rice-aroso-paint',
        unitPrice: 4200,
        totalPrice: 8400,
        interpretation: { product: 'Rice', quantity: 2, unit: 'paint' },
      });
    });

    it('rejects a buyPriceId that no longer exists or is not currently available', async () => {
      const findUnique = jest.fn().mockResolvedValue(null);
      const service = new OrderQuoteNormalizerService(
        { buyPrice: { findUnique } } as never,
        priceUnitsService as never,
      );

      await expect(
        service.resolveChoice({ buyPriceId: 'missing', quantity: 1 }),
      ).rejects.toThrow('Buy price missing is not currently available');
    });

    it('rejects a buyPriceId that has been deactivated by a newer price', async () => {
      const findUnique = jest
        .fn()
        .mockResolvedValue({ ...buyPrice, isActive: false });
      const service = new OrderQuoteNormalizerService(
        { buyPrice: { findUnique } } as never,
        priceUnitsService as never,
      );

      await expect(
        service.resolveChoice({
          buyPriceId: 'rice-aroso-paint',
          quantity: 1,
        }),
      ).rejects.toThrow('is not currently available');
    });
  });
});
