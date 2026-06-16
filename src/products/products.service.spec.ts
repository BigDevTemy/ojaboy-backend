import {
  PriceUnit,
  Prisma,
  ProductCategory,
  ProductStatus,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
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
      category: ProductCategory.Grains,
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
          unit: PriceUnit.bag,
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
            unit: PriceUnit.bag,
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
          category: ProductCategory.Grains,
          status: ProductStatus.active,
        }),
        expect.objectContaining({
          name: 'Palm Oil',
          sku: 'PROD-OIL-PALM',
          category: ProductCategory.Oils,
          status: ProductStatus.active,
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

  it('creates a bulk upload template with product headers', () => {
    const service = new ProductsService({} as never);
    const workbook = XLSX.read(service.createBulkUploadTemplate(), {
      type: 'buffer',
    });
    const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Products, {
      header: 1,
    });

    expect(rows[0]).toEqual([
      'name',
      'sku',
      'description',
      'category',
      'imageUrl',
      'status',
    ]);
    expect(rows[1]).toEqual([
      'Local Rice',
      'PROD-GRA-RICE',
      'Clean local rice sold by bag.',
      ProductCategory.Grains,
      '',
      ProductStatus.active,
    ]);
  });

  it('reports invalid bulk upload rows without inserting them', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new ProductsService({
      product: { createMany },
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
          category: ProductCategory.Legumes,
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
        message: 'Invalid category "Wrong Category"',
      },
    ]);
  });
});
