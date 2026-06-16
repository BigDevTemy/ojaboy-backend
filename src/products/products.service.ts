import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductCategory, ProductStatus } from '@prisma/client';
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
      };
    };
  };
}>;

type ProductFilters = {
  search?: string;
  category?: ProductCategory;
  limit?: string;
  offset?: string;
};

type BulkProductRow = Partial<Record<keyof CreateProductDto, string>>;

type BulkProductError = {
  row: number;
  field?: keyof CreateProductDto | 'file';
  message: string;
};

const DEFAULT_PRODUCT_LIMIT = 20;
const MAX_PRODUCT_LIMIT = 50;
const MAX_BULK_PRODUCTS = 1000;
const PRODUCT_BULK_UPLOAD_HEADERS = [
  'name',
  'sku',
  'description',
  'category',
  'imageUrl',
  'status',
] as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: this.toProductData(createProductDto),
      include: { marketPrices: true, buyPrices: true },
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

    const seenSkus = new Set<string>();
    const errors: BulkProductError[] = [];
    const products: CreateProductDto[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const product = this.toBulkProduct(row, rowNumber, errors);

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

  createBulkUploadTemplate(): Buffer {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      [...PRODUCT_BULK_UPLOAD_HEADERS],
      [
        'Local Rice',
        'PROD-GRA-RICE',
        'Clean local rice sold by bag.',
        ProductCategory.Grains,
        '',
        ProductStatus.active,
      ],
    ]);

    sheet['!cols'] = [
      { wch: 24 },
      { wch: 22 },
      { wch: 40 },
      { wch: 18 },
      { wch: 36 },
      { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');

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

  async findByCategory(category: ProductCategory) {
    return this.findAll({ category });
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
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: this.toUpdateData(updateProductDto),
        include: { marketPrices: true, buyPrices: true },
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
      category: dto.category,
      imageUrl: dto.imageUrl?.trim(),
      status: dto.status,
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

  private toProductField(header: string): keyof CreateProductDto | undefined {
    const key = header
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    const fields: Record<string, keyof CreateProductDto> = {
      name: 'name',
      productname: 'name',
      description: 'description',
      desc: 'description',
      sku: 'sku',
      category: 'category',
      imageurl: 'imageUrl',
      image: 'imageUrl',
      status: 'status',
    };

    return fields[key];
  }

  private toBulkProduct(
    row: BulkProductRow,
    rowNumber: number,
    errors: BulkProductError[],
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
      ? this.parseEnumValue(ProductCategory, row.category)
      : undefined;
    const status = row.status
      ? this.parseEnumValue(ProductStatus, row.status)
      : undefined;

    if (row.category && !category) {
      errors.push({
        row: rowNumber,
        field: 'category',
        message: `Invalid category "${row.category}"`,
      });
      return undefined;
    }

    if (row.status && !status) {
      errors.push({
        row: rowNumber,
        field: 'status',
        message: `Invalid status "${row.status}"`,
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
      category,
      imageUrl: row.imageUrl || undefined,
      status,
    };
  }

  private parseEnumValue<T extends Record<string, string>>(
    values: T,
    value: string,
  ): T[keyof T] | undefined {
    const normalized = value.trim().toLowerCase();
    return Object.values(values).find(
      (candidate) => candidate.toLowerCase() === normalized,
    ) as T[keyof T] | undefined;
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
      category: dto.category,
      imageUrl: dto.imageUrl?.trim(),
      status: dto.status,
    };
  }

  private toWhereInput(filters: ProductFilters): Prisma.ProductWhereInput {
    const search = filters.search?.trim();

    return {
      category: filters.category,
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
        },
      },
    } satisfies Prisma.ProductInclude;
  }

  private toProductResponse(product: ProductWithPriceOptions) {
    const priceByUnit = new Map<
      string,
      ProductWithPriceOptions['buyPrices'][number]
    >();

    for (const price of product.buyPrices) {
      if (!priceByUnit.has(price.unit)) {
        priceByUnit.set(price.unit, price);
      }
    }

    return {
      ...product,
      availableUnits: [...priceByUnit.values()].map((price) => ({
        unit: price.unit,
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
