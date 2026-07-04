import * as XLSX from 'xlsx';
import { CatalogueBulkService } from './catalogue-bulk.service';

describe('CatalogueBulkService', () => {
  const prisma = {
    productCategory: { findMany: jest.fn() },
    market: { findMany: jest.fn() },
    product: { findMany: jest.fn() },
    productVariant: { findMany: jest.fn() },
    manufacturer: { findMany: jest.fn() },
    brand: { findMany: jest.fn() },
    productPackage: { findMany: jest.fn() },
    productOffering: { findMany: jest.fn() },
  };
  const priceUnitsService = {
    getLookup: jest.fn().mockResolvedValue({
      activeCodes: () => ['bag', 'basket', 'kg'],
      getByCode: (code: string) =>
        ['bag', 'basket', 'kg'].includes(code)
          ? { id: `${code}-unit-id`, code, isActive: true }
          : undefined,
    }),
  };
  const service = new CatalogueBulkService(
    prisma as never,
    priceUnitsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.productCategory.findMany.mockResolvedValue([
      {
        id: 'category-1',
        name: 'Vegetables',
        slug: 'vegetables',
        description: null,
      },
    ]);
    prisma.market.findMany.mockResolvedValue([
      {
        id: 'market-1',
        marketname: 'Mile 12 Market',
        marketaddress: 'Lagos',
      },
      {
        id: 'market-2',
        marketname: 'Oyingbo Market',
        marketaddress: 'Lagos',
      },
    ]);
    prisma.product.findMany.mockResolvedValue([]);
    prisma.productVariant.findMany.mockResolvedValue([]);
    prisma.manufacturer.findMany.mockResolvedValue([]);
    prisma.brand.findMany.mockResolvedValue([]);
    prisma.productPackage.findMany.mockResolvedValue([]);
    prisma.productOffering.findMany.mockResolvedValue([]);
  });

  it('creates a catalogue template with reference and instruction sheets', async () => {
    const buffer = await service.createTemplate();
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    expect(workbook.SheetNames).toEqual([
      'Catalogue Upload',
      'Categories',
      'Markets',
      'Allowed Values',
      'Instructions',
    ]);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['Catalogue Upload'],
    );
    expect(rows[0]).toMatchObject({
      productName: 'Tomatoes',
      variantName: 'Tomatoes North',
      packageName: 'Big Basket',
      marketName: 'Mile 12 Market',
      priceUnit: 'basket',
    });
  });

  it('accepts one offering repeated for prices in multiple markets', async () => {
    const file = workbookFile([
      validRow({ marketName: 'Mile 12 Market', price: 40000 }),
      validRow({ marketName: 'Oyingbo Market', price: 42000 }),
    ]);

    const result = await service.validate(file);

    expect(result.valid).toBe(true);
    expect(result.summary).toMatchObject({
      receivedRows: 2,
      products: 1,
      offerings: 1,
      initialPrices: 2,
    });
    expect(result.errors).toEqual([]);
  });

  it('reports unknown categories and incomplete initial prices by row', async () => {
    const file = workbookFile([
      validRow({
        categorySlug: 'not-a-category',
        marketName: '',
        price: 40000,
      }),
    ]);

    const result = await service.validate(file);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          row: 2,
          field: 'categorySlug',
        }),
        expect.objectContaining({
          row: 2,
          field: 'marketName',
        }),
      ]),
    );
  });
});

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    productName: 'Tomatoes',
    productSku: 'PROD-TOMATO',
    categorySlug: 'vegetables',
    description: 'Fresh tomatoes',
    imageUrl: '',
    variantName: 'Tomatoes North',
    variantCode: 'NORTH',
    manufacturerName: '',
    brandName: 'Big Basket',
    packageName: 'Big Basket',
    packageType: 'basket',
    baseUnit: '',
    packageQuantity: '',
    offeringSku: 'TOMATO-NORTH-BIG-BASKET',
    marketName: 'Mile 12 Market',
    price: 40000,
    currency: 'NGN',
    priceUnit: 'basket',
    observedAt: '2026-06-25T08:00:00.000Z',
    qualityGrade: 'standard',
    notes: '',
    ...overrides,
  };
}

function workbookFile(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(rows),
    'Catalogue Upload',
  );
  return {
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  } as Express.Multer.File;
}
