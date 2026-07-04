import { Prisma, ProductStatus } from '@prisma/client';

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
import * as XLSX from 'xlsx';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const grainsCategory = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Grains',
    slug: 'grains',
  };
  const oilsCategory = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Oils',
    slug: 'oils',
  };
  const legumesCategory = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Legumes',
    slug: 'legumes',
  };
  function spreadsheetFile(rows: Record<string, unknown>[]) {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return { buffer } as Express.Multer.File;
  }

  it('adds availableUnits to product search results from active buy prices', async () => {
    const product = {
      id: 'product-id',
      name: 'Local Rice',
      description: null,
      sku: 'PROD-GRA-RICE',
      categoryId: grainsCategory.id,
      category: grainsCategory,
      imageUrl: null,
      status: ProductStatus.active,
      createdAt: new Date(),
      updatedAt: new Date(),
      marketPrices: [],
      buyPrices: [
        {
          id: 'rice-bag-price',
          productId: 'product-id',
          marketId: 'market-id',
          marketPriceId: null,
          baseMarketPrice: new Prisma.Decimal(72000),
          marginAmount: new Prisma.Decimal(0),
          logisticsBuffer: new Prisma.Decimal(0),
          riskBuffer: new Prisma.Decimal(0),
          finalPrice: new Prisma.Decimal(72000),
          currency: 'NGN',
          priceUnitId: bagUnit.id,
          priceUnit: bagUnit,
          strategyUsed: 'cheapest',
          isActive: true,
          validFrom: new Date(),
          validUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          market: {
            id: 'market-id',
            marketname: 'Daleko Market',
            marketaddress: 'Mushin, Lagos',
          },
        },
      ],
    };
    const findMany = jest.fn().mockResolvedValue([product]);
    const service = new ProductsService({
      product: { findMany },
    } as never);

    const result = await service.findAll({ search: 'rice', limit: '10' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        include: expect.objectContaining({
          buyPrices: expect.objectContaining({
            where: expect.objectContaining({ isActive: true }),
          }),
        }),
      }),
    );
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: product.id,
        availableUnits: [
          {
            unit: bagUnit.code,
            currentPrice: 72000,
            currency: 'NGN',
            buyPriceId: 'rice-bag-price',
            market: product.buyPrices[0].market,
          },
        ],
      }),
    );
  });

  it('bulk uploads products from a spreadsheet file', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new ProductsService({
      product: { createMany },
      productCategory: {
        findMany: jest.fn().mockResolvedValue([grainsCategory, oilsCategory]),
      },
    } as never);

    const result = await service.bulkUpload(
      spreadsheetFile([
        {
          name: 'Local Rice',
          sku: 'PROD-GRA-RICE',
          category: 'Grains',
          status: 'active',
        },
        {
          name: 'Palm Oil',
          sku: 'PROD-OIL-PALM',
          category: 'Oils',
          status: 'active',
        },
      ]),
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'Local Rice',
          sku: 'PROD-GRA-RICE',
          categoryId: grainsCategory.id,
        }),
        expect.objectContaining({
          name: 'Palm Oil',
          sku: 'PROD-OIL-PALM',
          categoryId: oilsCategory.id,
        }),
      ],
      skipDuplicates: true,
    });
    expect(result.summary).toEqual({
      received: 2,
      valid: 2,
      inserted: 2,
      skipped: 0,
      failed: 0,
    });
  });

  it('creates a bulk upload template with current category references', async () => {
    const service = new ProductsService({
      productCategory: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { ...grainsCategory, description: 'Grain products', sortOrder: 10 },
          ]),
      },
    } as never);
    const workbook = XLSX.read(await service.createBulkUploadTemplate(), {
      type: 'buffer',
    });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Products, {
      header: 1,
    });
    const categories = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets.Categories,
      { header: 1 },
    );

    expect(rows[0]).toEqual([
      'name',
      'sku',
      'description',
      'categorySlug',
      'imageUrl',
    ]);
    expect(rows[1]).toEqual([
      'Local Rice',
      'PROD-GRA-RICE',
      'Clean local rice sold by bag.',
      'grains',
      '',
    ]);
    expect(categories[0]).toEqual([
      'categoryId',
      'name',
      'slug',
      'description',
    ]);
    expect(categories[1]).toEqual([
      grainsCategory.id,
      'Grains',
      'grains',
      'Grain products',
    ]);
    expect(workbook.SheetNames).toEqual([
      'Products',
      'Categories',
      'Instructions',
    ]);
  });

  it('reports invalid bulk upload rows without inserting them', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ProductsService({
      product: { createMany },
      productCategory: {
        findMany: jest.fn().mockResolvedValue([legumesCategory]),
      },
    } as never);

    const result = await service.bulkUpload(
      spreadsheetFile([
        { name: '', sku: 'NO-NAME' },
        { name: 'Rice', sku: 'RICE-001', category: 'Wrong Category' },
        { name: 'Beans', sku: 'BEANS-001', category: 'Legumes' },
      ]),
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          name: 'Beans',
          sku: 'BEANS-001',
          categoryId: legumesCategory.id,
        }),
      ],
      skipDuplicates: true,
    });
    expect(result.summary).toEqual({
      received: 3,
      valid: 1,
      inserted: 1,
      skipped: 0,
      failed: 2,
    });
    expect(result.errors).toEqual([
      { row: 2, field: 'name', message: 'Name is required' },
      {
        row: 3,
        field: 'category',
        message: 'Active category "Wrong Category" was not found',
      },
    ]);
  });
});
