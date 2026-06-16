import { OrderQuoteNormalizerService } from './order-quote-normalizer.service';

describe('OrderQuoteNormalizerService', () => {
  const catalog = [
    {
      id: 'palm-oil-bottle',
      productId: 'palm-oil',
      unit: 'bottle',
      finalPrice: 4000,
      product: { id: 'palm-oil', name: 'Palm Oil' },
    },
    {
      id: 'garri-basket',
      productId: 'garri',
      unit: 'basket',
      finalPrice: 20000,
      product: { id: 'garri', name: 'Garri' },
    },
    {
      id: 'rice-derica',
      productId: 'rice',
      unit: 'derica',
      finalPrice: 2500,
      product: { id: 'rice', name: 'Rice' },
    },
  ];

  const createService = () =>
    new OrderQuoteNormalizerService({
      buyPrice: {
        findMany: jest.fn().mockResolvedValue(catalog),
      },
    } as never);

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
});
