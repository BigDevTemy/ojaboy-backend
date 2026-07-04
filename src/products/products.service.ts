import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductWithPriceOptions = Prisma.ProductGetPayload<{
  include: {
    marketPrices: {
      include: {
        market: {
          select: { id: true; marketname: true; marketaddress: true };
        };
      };
    };
    buyPrices: {
      include: {
        market: {
          select: { id: true; marketname: true; marketaddress: true };
        };
        priceUnit: true;
      };
    };
    variants: true;
    offerings: {
      include: {
        variant: true;
        brand: {
          include: { manufacturer: true };
        };
        package: true;
      };
    };
    category: true;
  };
}>;

type ProductFilters = {
  search?: string;
  categoryId?: string;
  limit?: string;
  offset?: string;
};

type BulkProductRow = Partial<{
  name: string;
  sku: string;
  description: string;
  category: string;
  imageUrl: string;
}>;

type BulkProductError = {
  row: number;
  field?: keyof BulkProductRow | 'file';
  message: string;
};

const DEFAULT_PRODUCT_LIMIT = 20;
const MAX_PRODUCT_LIMIT = 50;
const MAX_BULK_PRODUCTS = 1000;
const PRODUCT_BULK_UPLOAD_HEADERS = [
  'name',
  'sku',
  'description',
  'categorySlug',
  'imageUrl',
] as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    await this.requireActiveCategory(createProductDto.categoryId);
    const product = await this.prisma.product.create({
      data: this.toProductData(createProductDto),
      include: { category: true, marketPrices: true, buyPrices: true },
    });

    return {
      message: 'Product created successfully.',
      product,
    };
  }

  async bulkUpload(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Product upload file is required');
    }

    const rows = this.readProductRows(file);

    if (rows.length === 0) {
      throw new BadRequestException(
        'Product upload file does not contain rows',
      );
    }

    if (rows.length > MAX_BULK_PRODUCTS) {
      throw new BadRequestException(
        `Product upload cannot exceed ${MAX_BULK_PRODUCTS} rows`,
      );
    }

    const categories = await this.prisma.productCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true },
    });
    const categoriesByKey = new Map(
      categories.flatMap((category) => [
        [category.id.toLowerCase(), category],
        [category.name.toLowerCase(), category],
        [category.slug.toLowerCase(), category],
      ]),
    );
    const seenSkus = new Set<string>();
    const errors: BulkProductError[] = [];
    const products: CreateProductDto[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const product = this.toBulkProduct(
        row,
        rowNumber,
        errors,
        categoriesByKey,
      );

      if (!product) return;

      const skuKey = product.sku.toLowerCase();
      if (seenSkus.has(skuKey)) {
        errors.push({
          row: rowNumber,
          field: 'sku',
          message: 'Duplicate SKU in upload file',
        });
        return;
      }

      seenSkus.add(skuKey);
      products.push(product);
    });

    if (products.length === 0) {
      return {
        message: 'No products were imported.',
        summary: {
          received: rows.length,
          valid: 0,
          inserted: 0,
          skipped: 0,
          failed: errors.length,
        },
        errors,
      };
    }

    const result = await this.prisma.product.createMany({
      data: products.map((product) => this.toProductData(product)),
      skipDuplicates: true,
    });

    return {
      message: 'Product bulk upload processed.',
      summary: {
        received: rows.length,
        valid: products.length,
        inserted: result.count,
        skipped: products.length - result.count,
        failed: errors.length,
      },
      errors,
    };
  }

  async createBulkUploadTemplate(): Promise<Buffer> {
    const categories = await this.prisma.productCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const workbook = XLSX.utils.book_new();
    const productSheet = XLSX.utils.aoa_to_sheet([
      [...PRODUCT_BULK_UPLOAD_HEADERS],
      [
        'Local Rice',
        'PROD-GRA-RICE',
        'Clean local rice sold by bag.',
        'grains',
        '',
      ],
      [
        'Fresh Tomatoes',
        'PROD-VEG-TOMATOES',
        'Fresh tomatoes.',
        'vegetables',
        '',
      ],
    ]);

    productSheet['!cols'] = [
      { wch: 24 },
      { wch: 22 },
      { wch: 40 },
      { wch: 24 },
      { wch: 36 },
    ];
    productSheet['!autofilter'] = { ref: 'A1:E3' };

    XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');

    const categorySheet = XLSX.utils.aoa_to_sheet([
      ['categoryId', 'name', 'slug', 'description'],
      ...categories.map((category) => [
        category.id,
        category.name,
        category.slug,
        category.description ?? '',
      ]),
    ]);
    categorySheet['!cols'] = [
      { wch: 38 },
      { wch: 24 },
      { wch: 24 },
      { wch: 60 },
    ];
    if (categories.length) {
      categorySheet['!autofilter'] = {
        ref: `A1:D${categories.length + 1}`,
      };
    }
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categories');

    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ['Column', 'Required', 'Instructions'],
      ['name', 'Yes', 'Base product name, for example Tomatoes or Rice.'],
      ['sku', 'Yes', 'Unique product SKU.'],
      ['description', 'No', 'Optional product description.'],
      [
        'categorySlug',
        'Yes',
        'Use an active slug from the Categories sheet. A category ID or exact category name is also accepted.',
      ],
      ['imageUrl', 'No', 'Optional valid image URL.'],
      [],
      ['Important'],
      [
        'This template creates base products only. Variants, brands, packages, offerings and prices are managed after the base product exists or through the catalogue-specific bulk workflow.',
      ],
      [
        'Product status is not accepted during creation. New products use the backend active default.',
      ],
      [
        'Do not add duplicate SKUs. Rows with unknown or inactive categories are rejected.',
      ],
    ]);
    instructionSheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 105 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async findAll(filters: ProductFilters = {}) {
    const pagination = this.toPagination(filters);
    const now = new Date();
    const queryArgs = {
      where: this.toWhereInput(filters),
      include: this.toProductListInclude(now),
      orderBy: { name: 'asc' },
      take: pagination.limit,
      skip: pagination.offset,
    } satisfies Prisma.ProductFindManyArgs;

    const products = await this.findManyWithConnectionRetry(queryArgs);

    return {
      data: products.map((product) => this.toProductResponse(product)),
      meta: pagination,
    };
  }

  async findByCategory(categoryId: string) {
    return this.findAll({ categoryId });
  }

  async findOne(id: string) {
    const now = new Date();
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.toProductListInclude(now),
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return { product: this.toProductResponse(product) };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    if (updateProductDto.categoryId) {
      await this.requireActiveCategory(updateProductDto.categoryId);
    }
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: this.toUpdateData(updateProductDto),
        include: { category: true, marketPrices: true, buyPrices: true },
      });

      return {
        message: 'Product updated successfully.',
        product,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Product not found');
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    updateProductStatusDto: UpdateProductStatusDto,
  ) {
    return this.update(id, { status: updateProductStatusDto.status });
  }

  async remove(id: string) {
    try {
      await this.prisma.product.delete({
        where: { id },
      });

      return {
        message: 'Product deleted successfully.',
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Product not found');
      }

      throw error;
    }
  }

  private toProductData(
    dto: CreateProductDto,
  ): Prisma.ProductUncheckedCreateInput {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim(),
      sku: dto.sku.trim(),
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl?.trim(),
    };
  }

  private readProductRows(file: Express.Multer.File): BulkProductRow[] {
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new BadRequestException('Product upload file has no sheets');
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      });

      return rows.map((row) => this.normalizeBulkRow(row));
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(
        'Product upload file could not be parsed. Upload a valid .xlsx, .xls, or .csv file',
      );
    }
  }

  private normalizeBulkRow(row: Record<string, unknown>): BulkProductRow {
    const normalized: BulkProductRow = {};

    for (const [key, value] of Object.entries(row)) {
      const field = this.toProductField(key);

      if (field) {
        normalized[field] = String(value).trim();
      }
    }

    return normalized;
  }

  private toProductField(header: string): keyof BulkProductRow | undefined {
    const key = header
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    const fields: Record<string, keyof BulkProductRow> = {
      name: 'name',
      productname: 'name',
      description: 'description',
      desc: 'description',
      sku: 'sku',
      category: 'category',
      categoryid: 'category',
      categoryslug: 'category',
      imageurl: 'imageUrl',
      image: 'imageUrl',
    };

    return fields[key];
  }

  private toBulkProduct(
    row: BulkProductRow,
    rowNumber: number,
    errors: BulkProductError[],
    categoriesByKey: Map<string, { id: string; name: string; slug: string }>,
  ): CreateProductDto | undefined {
    const name = row.name?.trim();
    const sku = row.sku?.trim();

    if (!name) {
      errors.push({
        row: rowNumber,
        field: 'name',
        message: 'Name is required',
      });
    }

    if (!sku) {
      errors.push({
        row: rowNumber,
        field: 'sku',
        message: 'SKU is required',
      });
    }

    if (!name || !sku) {
      return undefined;
    }

    const category = row.category
      ? categoriesByKey.get(row.category.trim().toLowerCase())
      : undefined;

    if (!row.category || !category) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: row.category
          ? `Active category "${row.category}" was not found`
          : 'Category is required',
      });
      return undefined;
    }

    if (row.imageUrl && !this.isUrl(row.imageUrl)) {
      errors.push({
        row: rowNumber,
        field: 'imageUrl',
        message: 'Image URL must be a valid URL',
      });
      return undefined;
    }

    return {
      name,
      sku,
      description: row.description || undefined,
      categoryId: category.id,
      imageUrl: row.imageUrl || undefined,
    };
  }

  private isUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  private toUpdateData(
    dto: UpdateProductDto,
  ): Prisma.ProductUncheckedUpdateInput {
    return {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      sku: dto.sku?.trim(),
      categoryId: dto.categoryId,
      imageUrl: dto.imageUrl?.trim(),
      status: dto.status,
    };
  }

  private toWhereInput(filters: ProductFilters): Prisma.ProductWhereInput {
    const search = filters.search?.trim();

    return {
      categoryId: filters.categoryId,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private toProductListInclude(now: Date) {
    return {
      marketPrices: {
        orderBy: { observedAt: 'desc' },
        take: 5,
        include: {
          market: {
            select: { id: true, marketname: true, marketaddress: true },
          },
        },
      },
      category: true,
      buyPrices: {
        where: {
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        orderBy: [{ finalPrice: 'asc' }, { updatedAt: 'desc' }],
        include: {
          market: {
            select: { id: true, marketname: true, marketaddress: true },
          },
          priceUnit: true,
        },
      },
      variants: {
        orderBy: { name: 'asc' },
      },
      offerings: {
        include: {
          variant: true,
          brand: { include: { manufacturer: true } },
          package: true,
        },
        orderBy: { sku: 'asc' },
      },
    } satisfies Prisma.ProductInclude;
  }

  private toProductResponse(product: ProductWithPriceOptions) {
    const priceByUnit = new Map<
      string,
      ProductWithPriceOptions['buyPrices'][number]
    >();

    for (const price of product.buyPrices) {
      if (!priceByUnit.has(price.priceUnit.code)) {
        priceByUnit.set(price.priceUnit.code, price);
      }
    }

    return {
      ...product,
      availableOfferings: product.offerings ?? [],
      availableUnits: [...priceByUnit.values()].map((price) => ({
        unit: price.priceUnit.code,
        currentPrice: this.toNumber(price.finalPrice),
        currency: price.currency,
        buyPriceId: price.id,
        market: price.market,
      })),
    };
  }

  private toPagination(filters: ProductFilters) {
    return {
      limit: this.toBoundedInteger(
        filters.limit,
        DEFAULT_PRODUCT_LIMIT,
        MAX_PRODUCT_LIMIT,
      ),
      offset: this.toBoundedInteger(filters.offset, 0, Number.MAX_SAFE_INTEGER),
    };
  }

  private toBoundedInteger(
    value: string | undefined,
    fallback: number,
    max: number,
  ) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      return fallback;
    }

    return Math.min(parsed, max);
  }

  private async findManyWithConnectionRetry<
    T extends Prisma.ProductFindManyArgs,
  >(args: T): Promise<Prisma.ProductGetPayload<T>[]> {
    try {
      return (await this.prisma.product.findMany(
        args,
      )) as Prisma.ProductGetPayload<T>[];
    } catch (error) {
      if (!this.isTransientConnectionError(error)) {
        throw error;
      }

      await this.delay(100);

      return (await this.prisma.product.findMany(
        args,
      )) as Prisma.ProductGetPayload<T>[];
    }
  }

  private delay(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private async requireActiveCategory(categoryId: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });
    if (!category) {
      throw new NotFoundException('Product category not found');
    }
    if (!category.isActive) {
      throw new BadRequestException('Product category is not active');
    }
  }

  private isTransientConnectionError(error: unknown): boolean {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P1017'
    ) {
      return true;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    return [
      'Connection terminated due to connection timeout',
      'Connection terminated unexpectedly',
      'Server has closed the connection',
    ].some((message) => error.message.includes(message));
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
