import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PackageType,
  PriceQualityGrade,
  PriceSource,
  Prisma,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { PriceUnitLookup } from '../price-units/price-unit-lookup';

const MAX_ROWS = 3000;
const UPLOAD_SHEET = 'Catalogue Upload';
const HEADERS = [
  'productName',
  'productSku',
  'categorySlug',
  'description',
  'imageUrl',
  'variantName',
  'variantCode',
  'manufacturerName',
  'brandName',
  'packageName',
  'packageType',
  'baseUnit',
  'packageQuantity',
  'offeringSku',
  'marketName',
  'price',
  'currency',
  'priceUnit',
  'observedAt',
  'qualityGrade',
  'notes',
] as const;

type Header = (typeof HEADERS)[number];
type RawRow = Partial<Record<Header, string>>;
type UploadError = { row: number; field?: Header | 'file'; message: string };

type ParsedRow = {
  rowNumber: number;
  productName: string;
  productSku: string;
  categoryId: string;
  categorySlug: string;
  description?: string;
  imageUrl?: string;
  variantName?: string;
  variantCode?: string;
  manufacturerName?: string;
  brandName?: string;
  packageName: string;
  packageType: PackageType;
  baseUnitId?: string;
  packageQuantity?: number;
  offeringSku: string;
  marketId?: string;
  marketName?: string;
  price?: number;
  currency?: string;
  priceUnitId?: string;
  observedAt?: Date;
  qualityGrade?: PriceQualityGrade;
  notes?: string;
};

type ExistingData = Awaited<ReturnType<CatalogueBulkService['loadExisting']>>;
type Analysis = {
  rows: ParsedRow[];
  errors: UploadError[];
  summary: Record<string, number>;
};

@Injectable()
export class CatalogueBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async createTemplate(): Promise<Buffer> {
    const lookup = await this.priceUnitsService.getLookup();
    const [categories, markets] = await Promise.all([
      this.prisma.productCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true, description: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.market.findMany({
        where: { status: 'active' },
        select: { id: true, marketname: true, marketaddress: true },
        orderBy: { marketname: 'asc' },
      }),
    ]);

    const workbook = XLSX.utils.book_new();
    const upload = XLSX.utils.aoa_to_sheet([
      [...HEADERS],
      [
        'Tomatoes',
        'PROD-TOMATO',
        'vegetables',
        'Fresh tomatoes',
        '',
        'Tomatoes North',
        'NORTH',
        '',
        'Big Basket',
        'Big Basket',
        'basket',
        '',
        '',
        'TOMATO-NORTH-BIG-BASKET',
        markets[0]?.marketname ?? 'Mile 12 Market',
        40000,
        'NGN',
        'basket',
        new Date().toISOString(),
        'standard',
        '',
      ],
      [
        'Tomatoes',
        'PROD-TOMATO',
        'vegetables',
        'Fresh tomatoes',
        '',
        'Tomatoes South',
        'SOUTH',
        '',
        'Paint',
        'Paint',
        'bucket',
        '',
        '',
        'TOMATO-SOUTH-PAINT',
        markets[0]?.marketname ?? 'Mile 12 Market',
        2000,
        'NGN',
        'paint_bucket',
        new Date().toISOString(),
        'standard',
        '',
      ],
      [
        'Beans',
        'PROD-BEANS',
        'grains',
        'Beans',
        '',
        '',
        '',
        '',
        '',
        'Derica',
        'other',
        '',
        '',
        'BEANS-DERICA',
        markets[0]?.marketname ?? 'Mile 12 Market',
        1500,
        'NGN',
        'derica',
        new Date().toISOString(),
        'standard',
        '',
      ],
    ]);
    upload['!cols'] = HEADERS.map((header) => ({
      wch: ['description', 'notes', 'imageUrl'].includes(header) ? 35 : 20,
    }));
    upload['!autofilter'] = { ref: `A1:U4` };
    XLSX.utils.book_append_sheet(workbook, upload, UPLOAD_SHEET);

    const categorySheet = XLSX.utils.json_to_sheet(
      categories.map((category) => ({
        categoryId: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? '',
      })),
      { header: ['categoryId', 'name', 'slug', 'description'] },
    );
    categorySheet['!cols'] = [
      { wch: 38 },
      { wch: 25 },
      { wch: 25 },
      { wch: 50 },
    ];
    XLSX.utils.book_append_sheet(workbook, categorySheet, 'Categories');

    const marketSheet = XLSX.utils.json_to_sheet(
      markets.map((market) => ({
        marketId: market.id,
        marketName: market.marketname,
        address: market.marketaddress ?? '',
      })),
      { header: ['marketId', 'marketName', 'address'] },
    );
    marketSheet['!cols'] = [{ wch: 38 }, { wch: 30 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(workbook, marketSheet, 'Markets');

    const values = XLSX.utils.aoa_to_sheet([
      ['Field', 'Allowed values'],
      ['packageType', Object.values(PackageType).join(', ')],
      ['baseUnit', `${lookup.activeCodes().join(', ')} (optional)`],
      ['priceUnit', lookup.activeCodes().join(', ')],
      ['qualityGrade', Object.values(PriceQualityGrade).join(', ')],
      ['currency', 'NGN (or another 3-letter currency code)'],
    ]);
    values['!cols'] = [{ wch: 22 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, values, 'Allowed Values');

    const instructions = XLSX.utils.aoa_to_sheet([
      ['Rule', 'Explanation'],
      [
        'One row = one offering in one market',
        'Repeat the same catalogue fields and offeringSku on another row to add a price for another market.',
      ],
      [
        'Product',
        'productName, productSku and categorySlug are required. The category must exist in the Categories sheet.',
      ],
      [
        'Variant',
        'Leave variantName and variantCode blank when the product has no variant. Otherwise both are required.',
      ],
      [
        'Brand',
        'Leave brandName blank for an unbranded product. manufacturerName is optional, but cannot be supplied without brandName.',
      ],
      [
        'Package',
        'packageName and packageType are required. baseUnit and packageQuantity must either both be filled or both be blank.',
      ],
      [
        'Offering',
        'offeringSku uniquely identifies the exact product + variant + brand + package combination.',
      ],
      [
        'Initial price',
        'marketName, price, priceUnit and observedAt must all be supplied together. Leave all four blank to create catalogue data without an initial price.',
      ],
      [
        'Safe import',
        'Call /validate first. /commit validates the workbook again and writes all records in one transaction.',
      ],
    ]);
    instructions['!cols'] = [{ wch: 25 }, { wch: 115 }];
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async validate(file?: Express.Multer.File) {
    const analysis = await this.analyze(file);
    return {
      valid: analysis.errors.length === 0,
      summary: analysis.summary,
      errors: analysis.errors,
      preview: analysis.rows.slice(0, 20).map((row) => ({
        row: row.rowNumber,
        productSku: row.productSku,
        offeringSku: row.offeringSku,
        marketName: row.marketName ?? null,
        price: row.price ?? null,
      })),
    };
  }

  async commit(file?: Express.Multer.File) {
    const analysis = await this.analyze(file);
    if (analysis.errors.length) {
      throw new BadRequestException({
        message: 'Catalogue upload validation failed. No data was written.',
        summary: analysis.summary,
        errors: analysis.errors,
      });
    }

    // writeRows does one sequential round trip per unique product/brand/
    // package/variant/offering, which can add up well past Prisma's default
    // 5s interactive-transaction timeout for a large sheet (MAX_ROWS = 3000).
    const result = await this.prisma.$transaction(
      async (tx) => this.writeRows(tx, analysis.rows),
      { timeout: 120_000 },
    );

    return {
      message: 'Product catalogue imported successfully.',
      summary: { ...analysis.summary, ...result },
    };
  }

  private async analyze(file?: Express.Multer.File): Promise<Analysis> {
    if (!file) {
      throw new BadRequestException('Catalogue upload file is required');
    }
    const rawRows = this.readRows(file);
    if (!rawRows.length) {
      throw new BadRequestException('Catalogue upload file contains no rows');
    }
    if (rawRows.length > MAX_ROWS) {
      throw new BadRequestException(
        `Catalogue upload cannot exceed ${MAX_ROWS} rows`,
      );
    }

    const existing = await this.loadExisting();
    const lookup = await this.priceUnitsService.getLookup();
    const errors: UploadError[] = [];
    const rows = rawRows
      .map((raw, index) =>
        this.parseRow(raw, index + 2, existing, lookup, errors),
      )
      .filter((row): row is ParsedRow => Boolean(row));

    this.validateFileConsistency(rows, existing, errors);
    return {
      rows,
      errors,
      summary: this.createSummary(rawRows.length, rows, existing, errors),
    };
  }

  private readRows(file: Express.Multer.File): RawRow[] {
    try {
      const workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        cellDates: true,
      });
      const sheet =
        workbook.Sheets[UPLOAD_SHEET] ??
        workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        throw new BadRequestException('Catalogue upload file has no sheets');
      }
      return XLSX.utils
        .sheet_to_json<Record<string, unknown>>(sheet, {
          defval: '',
          raw: false,
        })
        .map((row) => this.normalizeRow(row))
        .filter((row) => Object.values(row).some(Boolean));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        'Catalogue upload could not be parsed. Upload a valid .xlsx, .xls, or .csv file',
      );
    }
  }

  private normalizeRow(row: Record<string, unknown>): RawRow {
    const result: RawRow = {};
    const headerMap = new Map(
      HEADERS.map((header) => [this.key(header), header]),
    );
    for (const [header, value] of Object.entries(row)) {
      const field = headerMap.get(this.key(header));
      if (field) result[field] = String(value).trim();
    }
    return result;
  }

  private parseRow(
    raw: RawRow,
    rowNumber: number,
    existing: ExistingData,
    lookup: PriceUnitLookup,
    errors: UploadError[],
  ): ParsedRow | undefined {
    const before = errors.length;
    const required = (field: Header, label = field): string | undefined => {
      const value = raw[field]?.trim();
      if (!value) {
        errors.push({ row: rowNumber, field, message: `${label} is required` });
      }
      return value;
    };

    const productName = required('productName');
    const productSku = required('productSku')?.toUpperCase();
    const categoryValue = required('categorySlug');
    const packageName = required('packageName');
    const packageTypeValue = required('packageType');
    const offeringSku = required('offeringSku')?.toUpperCase();

    const category = categoryValue
      ? existing.categories.get(this.key(categoryValue))
      : undefined;
    if (categoryValue && !category) {
      errors.push({
        row: rowNumber,
        field: 'categorySlug',
        message: `Active category "${categoryValue}" was not found`,
      });
    }

    const packageType = this.enumValue(
      PackageType,
      packageTypeValue,
      rowNumber,
      'packageType',
      errors,
    );
    const baseUnitId = raw.baseUnit?.trim()
      ? this.priceUnitCode(raw.baseUnit, lookup, rowNumber, errors, 'baseUnit')
      : undefined;
    const packageQuantity = this.positiveNumber(
      raw.packageQuantity,
      rowNumber,
      'packageQuantity',
      errors,
      true,
    );
    if (Boolean(baseUnitId) !== (packageQuantity !== undefined)) {
      errors.push({
        row: rowNumber,
        field: baseUnitId ? 'packageQuantity' : 'baseUnit',
        message:
          'baseUnit and packageQuantity must either both be supplied or both be blank',
      });
    }

    const variantName = raw.variantName?.trim() || undefined;
    const variantCode = raw.variantCode?.trim().toUpperCase() || undefined;
    if (Boolean(variantName) !== Boolean(variantCode)) {
      errors.push({
        row: rowNumber,
        field: variantName ? 'variantCode' : 'variantName',
        message:
          'variantName and variantCode must either both be supplied or both be blank',
      });
    }

    const manufacturerName = raw.manufacturerName?.trim() || undefined;
    const brandName = raw.brandName?.trim() || undefined;
    if (manufacturerName && !brandName) {
      errors.push({
        row: rowNumber,
        field: 'brandName',
        message: 'brandName is required when manufacturerName is supplied',
      });
    }

    if (raw.imageUrl && !this.isUrl(raw.imageUrl)) {
      errors.push({
        row: rowNumber,
        field: 'imageUrl',
        message: 'imageUrl must be a valid URL',
      });
    }

    const requiredPriceFields = [raw.marketName, raw.priceUnit, raw.observedAt];
    const hasPrice =
      requiredPriceFields.some((value) => Boolean(value?.trim())) ||
      Boolean(raw.price?.trim());
    if (hasPrice && requiredPriceFields.some((value) => !value?.trim())) {
      errors.push({
        row: rowNumber,
        field: 'marketName',
        message:
          'marketName, priceUnit and observedAt must all be supplied together to record a price. price may be left blank or 0 if not yet known.',
      });
    }

    let market: ExistingData['marketList'][number] | undefined;
    let price: number | undefined;
    let priceUnitId: string | undefined;
    let observedAt: Date | undefined;
    let qualityGrade: PriceQualityGrade | undefined;
    if (hasPrice) {
      market = existing.markets.get(this.key(raw.marketName ?? ''));
      if (!market) {
        errors.push({
          row: rowNumber,
          field: 'marketName',
          message: `Active market "${raw.marketName}" was not found`,
        });
      }
      price = this.nonNegativeNumber(raw.price, rowNumber, 'price', errors);
      priceUnitId = this.priceUnitCode(raw.priceUnit, lookup, rowNumber, errors);
      observedAt = this.dateValue(
        raw.observedAt,
        rowNumber,
        'observedAt',
        errors,
      );
      qualityGrade =
        this.enumValue(
          PriceQualityGrade,
          raw.qualityGrade || PriceQualityGrade.standard,
          rowNumber,
          'qualityGrade',
          errors,
        ) ?? PriceQualityGrade.standard;
    }

    const currency = (raw.currency?.trim() || 'NGN').toUpperCase();
    if (hasPrice && !/^[A-Z]{3}$/.test(currency)) {
      errors.push({
        row: rowNumber,
        field: 'currency',
        message: 'currency must be a 3-letter code such as NGN',
      });
    }

    if (
      errors.length > before ||
      !productName ||
      !productSku ||
      !category ||
      !packageName ||
      !packageType ||
      !offeringSku
    ) {
      return undefined;
    }

    return {
      rowNumber,
      productName,
      productSku,
      categoryId: category.id,
      categorySlug: category.slug,
      description: raw.description?.trim() || undefined,
      imageUrl: raw.imageUrl?.trim() || undefined,
      variantName,
      variantCode,
      manufacturerName,
      brandName,
      packageName,
      packageType,
      baseUnitId,
      packageQuantity,
      offeringSku,
      marketId: market?.id,
      marketName: market?.marketname,
      price,
      currency: hasPrice ? currency : undefined,
      priceUnitId,
      observedAt,
      qualityGrade,
      notes: raw.notes?.trim() || undefined,
    };
  }

  private validateFileConsistency(
    rows: ParsedRow[],
    existing: ExistingData,
    errors: UploadError[],
  ) {
    const products = new Map<string, ParsedRow>();
    const variants = new Map<string, ParsedRow>();
    const manufacturers = new Map<string, ParsedRow>();
    const brands = new Map<string, ParsedRow>();
    const packages = new Map<string, ParsedRow>();
    const offerings = new Map<string, ParsedRow>();
    const identities = new Map<string, ParsedRow>();
    const prices = new Set<string>();

    for (const row of rows) {
      this.compareOrSet(
        products,
        this.key(row.productSku),
        row,
        ['productName', 'categoryId'],
        'productSku is reused with different product details',
        'productSku',
        errors,
      );
      if (row.variantName) {
        this.compareOrSet(
          variants,
          `${this.key(row.productSku)}|${this.key(row.variantName)}`,
          row,
          ['variantCode'],
          'variantName is reused with a different variantCode',
          'variantName',
          errors,
        );
      }
      if (row.manufacturerName) {
        this.compareOrSet(
          manufacturers,
          this.key(row.manufacturerName),
          row,
          [],
          '',
          'manufacturerName',
          errors,
        );
      }
      if (row.brandName) {
        this.compareOrSet(
          brands,
          this.key(row.brandName),
          row,
          ['manufacturerName'],
          'brandName is reused with a different manufacturer',
          'brandName',
          errors,
        );
      }
      this.compareOrSet(
        packages,
        this.key(row.packageName),
        row,
        ['packageType', 'baseUnitId', 'packageQuantity'],
        'packageName is reused with different package details',
        'packageName',
        errors,
      );
      this.compareOrSet(
        offerings,
        this.key(row.offeringSku),
        row,
        ['productSku', 'variantName', 'brandName', 'packageName'],
        'offeringSku is reused for a different offering',
        'offeringSku',
        errors,
      );

      const identity = [
        row.productSku,
        row.variantName ?? '',
        row.brandName ?? '',
        row.packageName,
      ]
        .map((value) => this.key(value))
        .join('|');
      const identityRow = identities.get(identity);
      if (identityRow && identityRow.offeringSku !== row.offeringSku) {
        errors.push({
          row: row.rowNumber,
          field: 'offeringSku',
          message:
            'The same product, variant, brand and package combination has another offeringSku',
        });
      } else {
        identities.set(identity, row);
      }

      if (row.marketId && row.observedAt) {
        const priceKey = `${this.key(row.offeringSku)}|${row.marketId}|${row.observedAt.toISOString()}`;
        if (prices.has(priceKey)) {
          errors.push({
            row: row.rowNumber,
            field: 'observedAt',
            message:
              'Duplicate price for the same offering, market and observedAt',
          });
        }
        prices.add(priceKey);
      }

      this.validateAgainstExisting(row, existing, errors);
    }
  }

  private validateAgainstExisting(
    row: ParsedRow,
    existing: ExistingData,
    errors: UploadError[],
  ) {
    const product = existing.products.get(this.key(row.productSku));
    if (
      product &&
      (this.key(product.name) !== this.key(row.productName) ||
        product.categoryId !== row.categoryId)
    ) {
      errors.push({
        row: row.rowNumber,
        field: 'productSku',
        message: 'Existing productSku has a different product name or category',
      });
    }

    const productPackage = existing.packages.get(this.key(row.packageName));
    if (
      productPackage &&
      (productPackage.packageType !== row.packageType ||
        (productPackage.baseUnitId ?? undefined) !== row.baseUnitId ||
        this.decimalNumber(productPackage.quantity) !== row.packageQuantity)
    ) {
      errors.push({
        row: row.rowNumber,
        field: 'packageName',
        message: 'Existing packageName has different package details',
      });
    }

    const brand = row.brandName
      ? existing.brands.get(this.key(row.brandName))
      : undefined;
    const manufacturer = row.manufacturerName
      ? existing.manufacturers.get(this.key(row.manufacturerName))
      : undefined;
    if (brand) {
      const expectedManufacturerId = manufacturer?.id ?? null;
      if (brand.manufacturerId !== expectedManufacturerId) {
        errors.push({
          row: row.rowNumber,
          field: 'manufacturerName',
          message: 'Existing brand is linked to a different manufacturer',
        });
      }
    }

    const offering = existing.offerings.get(this.key(row.offeringSku));
    if (offering) {
      const variant = row.variantName
        ? existing.variants.find(
            (item) =>
              item.productId === product?.id &&
              this.key(item.name) === this.key(row.variantName!),
          )
        : undefined;
      if (
        offering.productId !== product?.id ||
        offering.variantId !== (variant?.id ?? null) ||
        offering.brandId !== (brand?.id ?? null) ||
        offering.packageId !== productPackage?.id
      ) {
        errors.push({
          row: row.rowNumber,
          field: 'offeringSku',
          message: 'Existing offeringSku has different catalogue details',
        });
      }
    }
  }

  private async loadExisting() {
    const [
      categoryList,
      marketList,
      productList,
      variants,
      manufacturerList,
      brandList,
      packageList,
      offeringList,
    ] = await Promise.all([
      this.prisma.productCategory.findMany({
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.market.findMany({
        where: { status: 'active' },
        select: { id: true, marketname: true },
      }),
      this.prisma.product.findMany({
        select: { id: true, name: true, sku: true, categoryId: true },
      }),
      this.prisma.productVariant.findMany({
        select: { id: true, productId: true, name: true, code: true },
      }),
      this.prisma.manufacturer.findMany({
        select: { id: true, name: true },
      }),
      this.prisma.brand.findMany({
        select: { id: true, name: true, manufacturerId: true },
      }),
      this.prisma.productPackage.findMany({
        select: {
          id: true,
          name: true,
          packageType: true,
          baseUnitId: true,
          quantity: true,
        },
      }),
      this.prisma.productOffering.findMany({
        select: {
          id: true,
          sku: true,
          productId: true,
          variantId: true,
          brandId: true,
          packageId: true,
        },
      }),
    ]);

    return {
      categoryList,
      marketList,
      products: this.by(productList, (item) => item.sku),
      variants,
      manufacturers: this.by(manufacturerList, (item) => item.name),
      brands: this.by(brandList, (item) => item.name),
      packages: this.by(packageList, (item) => item.name),
      offerings: this.by(offeringList, (item) => item.sku),
      categories: new Map(
        categoryList.flatMap((item) => [
          [this.key(item.id), item],
          [this.key(item.name), item],
          [this.key(item.slug), item],
        ]),
      ),
      markets: new Map(
        marketList.flatMap((item) => [
          [this.key(item.id), item],
          [this.key(item.marketname), item],
        ]),
      ),
    };
  }

  private async writeRows(
    tx: Prisma.TransactionClient,
    rows: ParsedRow[],
  ): Promise<Record<string, number>> {
    const products = new Map<string, string>();
    const manufacturers = new Map<string, string>();
    const brands = new Map<string, string>();
    const packages = new Map<string, string>();
    const variants = new Map<string, string>();
    const offerings = new Map<string, string>();
    const counts = {
      productsCreated: 0,
      variantsCreated: 0,
      manufacturersCreated: 0,
      brandsCreated: 0,
      packagesCreated: 0,
      offeringsCreated: 0,
      pricesCreated: 0,
      pricesSkipped: 0,
    };

    for (const row of this.unique(rows, (item) => item.productSku)) {
      const existing = await tx.product.findUnique({
        where: { sku: row.productSku },
        select: { id: true },
      });
      const product =
        existing ??
        (await tx.product.create({
          data: {
            name: row.productName,
            sku: row.productSku,
            categoryId: row.categoryId,
            description: row.description,
            imageUrl: row.imageUrl,
          },
          select: { id: true },
        }));
      if (!existing) counts.productsCreated++;
      products.set(this.key(row.productSku), product.id);
    }

    for (const row of this.unique(
      rows.filter((item) => item.manufacturerName),
      (item) => item.manufacturerName!,
    )) {
      const existing = await tx.manufacturer.findUnique({
        where: { name: row.manufacturerName! },
        select: { id: true },
      });
      const manufacturer =
        existing ??
        (await tx.manufacturer.create({
          data: { name: row.manufacturerName! },
          select: { id: true },
        }));
      if (!existing) counts.manufacturersCreated++;
      manufacturers.set(this.key(row.manufacturerName!), manufacturer.id);
    }

    for (const row of this.unique(
      rows.filter((item) => item.brandName),
      (item) => item.brandName!,
    )) {
      const existing = await tx.brand.findUnique({
        where: { name: row.brandName! },
        select: { id: true },
      });
      const brand =
        existing ??
        (await tx.brand.create({
          data: {
            name: row.brandName!,
            manufacturerId: row.manufacturerName
              ? manufacturers.get(this.key(row.manufacturerName))
              : undefined,
          },
          select: { id: true },
        }));
      if (!existing) counts.brandsCreated++;
      brands.set(this.key(row.brandName!), brand.id);
    }

    for (const row of this.unique(rows, (item) => item.packageName)) {
      const existing = await tx.productPackage.findUnique({
        where: { name: row.packageName },
        select: { id: true },
      });
      const productPackage =
        existing ??
        (await tx.productPackage.create({
          data: {
            name: row.packageName,
            packageType: row.packageType,
            baseUnitId: row.baseUnitId,
            quantity: row.packageQuantity,
          },
          select: { id: true },
        }));
      if (!existing) counts.packagesCreated++;
      packages.set(this.key(row.packageName), productPackage.id);
    }

    for (const row of this.unique(
      rows.filter((item) => item.variantName),
      (item) => `${item.productSku}|${item.variantName}`,
    )) {
      const productId = products.get(this.key(row.productSku))!;
      const existing = await tx.productVariant.findFirst({
        where: { productId, name: row.variantName! },
        select: { id: true },
      });
      const variant =
        existing ??
        (await tx.productVariant.create({
          data: {
            productId,
            name: row.variantName!,
            code: row.variantCode!,
          },
          select: { id: true },
        }));
      if (!existing) counts.variantsCreated++;
      variants.set(
        `${this.key(row.productSku)}|${this.key(row.variantName!)}`,
        variant.id,
      );
    }

    for (const row of this.unique(rows, (item) => item.offeringSku)) {
      const existing = await tx.productOffering.findUnique({
        where: { sku: row.offeringSku },
        select: { id: true },
      });
      const offering =
        existing ??
        (await tx.productOffering.create({
          data: {
            productId: products.get(this.key(row.productSku))!,
            variantId: row.variantName
              ? variants.get(
                  `${this.key(row.productSku)}|${this.key(row.variantName)}`,
                )
              : undefined,
            brandId: row.brandName
              ? brands.get(this.key(row.brandName))
              : undefined,
            packageId: packages.get(this.key(row.packageName))!,
            sku: row.offeringSku,
          },
          select: { id: true },
        }));
      if (!existing) counts.offeringsCreated++;
      offerings.set(this.key(row.offeringSku), offering.id);
    }

    const priceRows = rows.filter(
      (row) => row.marketId && row.price !== undefined && row.observedAt,
    );
    if (priceRows.length) {
      const result = await tx.marketPrice.createMany({
        data: priceRows.map((row) => ({
          productId: products.get(this.key(row.productSku))!,
          productOfferingId: offerings.get(this.key(row.offeringSku))!,
          marketId: row.marketId!,
          amount: row.price!,
          currency: row.currency!,
          priceUnitId: row.priceUnitId!,
          quantity: 1,
          qualityGrade: row.qualityGrade!,
          source: PriceSource.manual,
          observedAt: row.observedAt!,
          notes: row.notes,
        })),
        skipDuplicates: true,
      });
      counts.pricesCreated = result.count;
      counts.pricesSkipped = priceRows.length - result.count;
    }

    return counts;
  }

  private createSummary(
    received: number,
    rows: ParsedRow[],
    existing: ExistingData,
    errors: UploadError[],
  ) {
    const unique = <T>(values: T[]) => new Set(values).size;
    return {
      receivedRows: received,
      validRows: rows.length,
      invalidRows: unique(errors.map((error) => error.row)),
      errorCount: errors.length,
      products: unique(rows.map((row) => this.key(row.productSku))),
      variants: unique(
        rows
          .filter((row) => row.variantName)
          .map(
            (row) =>
              `${this.key(row.productSku)}|${this.key(row.variantName!)}`,
          ),
      ),
      brands: unique(
        rows
          .filter((row) => row.brandName)
          .map((row) => this.key(row.brandName!)),
      ),
      packages: unique(rows.map((row) => this.key(row.packageName))),
      offerings: unique(rows.map((row) => this.key(row.offeringSku))),
      initialPrices: rows.filter((row) => row.price !== undefined).length,
      existingProductsReused: unique(
        rows
          .filter((row) => existing.products.has(this.key(row.productSku)))
          .map((row) => this.key(row.productSku)),
      ),
      existingOfferingsReused: unique(
        rows
          .filter((row) => existing.offerings.has(this.key(row.offeringSku)))
          .map((row) => this.key(row.offeringSku)),
      ),
    };
  }

  private compareOrSet(
    map: Map<string, ParsedRow>,
    key: string,
    row: ParsedRow,
    fields: (keyof ParsedRow)[],
    message: string,
    field: Header,
    errors: UploadError[],
  ) {
    const first = map.get(key);
    if (
      first &&
      fields.some(
        (name) =>
          this.key(String(first[name] ?? '')) !==
          this.key(String(row[name] ?? '')),
      )
    ) {
      errors.push({ row: row.rowNumber, field, message });
    } else if (!first) {
      map.set(key, row);
    }
  }

  private enumValue<T extends Record<string, string>>(
    values: T,
    input: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
    optional = false,
  ): T[keyof T] | undefined {
    const value = input?.trim().toLowerCase();
    if (!value && optional) return undefined;
    const allowed = Object.values(values);
    const match = allowed.find((item) => item.toLowerCase() === value);
    if (!match) {
      errors.push({
        row,
        field,
        message: `${field} must be one of: ${allowed.join(', ')}`,
      });
      return undefined;
    }
    return match as T[keyof T];
  }

  private priceUnitCode(
    input: string | undefined,
    lookup: PriceUnitLookup,
    row: number,
    errors: UploadError[],
    field: Header = 'priceUnit',
  ): string | undefined {
    const value = input?.trim();
    if (!value) {
      errors.push({ row, field, message: `${field} is required` });
      return undefined;
    }
    const unit = lookup.getByCode(value);
    if (!unit || !unit.isActive) {
      errors.push({
        row,
        field,
        message: `${field} must be one of: ${lookup.activeCodes().join(', ')}`,
      });
      return undefined;
    }
    return unit.id;
  }

  private positiveNumber(
    input: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
    optional = false,
  ): number | undefined {
    if (!input?.trim() && optional) return undefined;
    const value = Number(String(input).replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      errors.push({
        row,
        field,
        message: `${field} must be greater than zero`,
      });
      return undefined;
    }
    return value;
  }

  /**
   * Like positiveNumber, but treats blank input as 0 and allows 0 itself.
   * Used for `price`, since the exact market price is often not known yet
   * when an offering is first catalogued; a 0/blank price is deliberately
   * left out of buy-price calculations rather than rejected at upload time.
   */
  private nonNegativeNumber(
    input: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
  ): number {
    const trimmed = input?.trim();
    if (!trimmed) return 0;
    const value = Number(trimmed.replace(/,/g, ''));
    if (!Number.isFinite(value) || value < 0) {
      errors.push({
        row,
        field,
        message: `${field} must be zero or a positive number`,
      });
      return 0;
    }
    return value;
  }

  private dateValue(
    input: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
  ): Date | undefined {
    const value = new Date(input ?? '');
    if (Number.isNaN(value.getTime())) {
      errors.push({
        row,
        field,
        message: 'observedAt must be a valid date, preferably ISO 8601',
      });
      return undefined;
    }
    return value;
  }

  private decimalNumber(value: Prisma.Decimal | null): number | undefined {
    return value === null ? undefined : value.toNumber();
  }

  private by<T>(values: T[], selector: (value: T) => string) {
    return new Map(values.map((value) => [this.key(selector(value)), value]));
  }

  private unique<T>(values: T[], selector: (value: T) => string): T[] {
    return [
      ...new Map(
        values.map((value) => [this.key(selector(value)), value]),
      ).values(),
    ];
  }

  private key(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  private isUrl(value: string) {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}
