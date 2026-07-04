import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PriceQualityGrade,
  PriceSource,
  Prisma,
  ProductPackage,
} from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { PriceUnitLookup } from '../price-units/price-unit-lookup';

const MAX_ROWS = 3000;
const UPLOAD_SHEET = 'Market Prices Upload';
const HEADERS = [
  'productOfferingSku',
  'productOfferingId',
  'marketName',
  'marketId',
  'amount',
  'currency',
  'priceUnit',
  'quantity',
  'qualityGrade',
  'source',
  'observedAt',
  'notes',
] as const;

type Header = (typeof HEADERS)[number];
type RawRow = Partial<Record<Header, string>>;
type UploadError = { row: number; field?: Header | 'file'; message: string };
type ExistingData = Awaited<
  ReturnType<MarketPricesBulkService['loadExisting']>
>;

type ParsedRow = {
  rowNumber: number;
  productId: string;
  productOfferingId: string;
  productOfferingSku: string;
  marketId: string;
  marketName: string;
  amount: number;
  currency: string;
  priceUnitId: string;
  unitCode: string;
  quantity?: number;
  qualityGrade: PriceQualityGrade;
  source: PriceSource;
  observedAt: Date;
  notes?: string;
};

type Analysis = {
  rows: ParsedRow[];
  errors: UploadError[];
  summary: Record<string, number>;
};

@Injectable()
export class MarketPricesBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async createTemplate(): Promise<Buffer> {
    const lookup = await this.priceUnitsService.getLookup();
    const [offerings, markets] = await Promise.all([
      this.prisma.productOffering.findMany({
        where: { isActive: true, product: { status: 'active' } },
        select: {
          id: true,
          sku: true,
          product: { select: { name: true, sku: true } },
          variant: { select: { name: true } },
          brand: { select: { name: true } },
          package: {
            select: {
              name: true,
              packageType: true,
              baseUnit: true,
              quantity: true,
            },
          },
        },
        orderBy: { sku: 'asc' },
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
        offerings[0]?.sku ?? 'RICE-MAMA-GOLD-BAG',
        offerings[0]?.id ?? '',
        markets[0]?.marketname ?? 'Mile 12 Market',
        markets[0]?.id ?? '',
        70000,
        'NGN',
        '',
        1,
        PriceQualityGrade.standard,
        PriceSource.manual,
        new Date().toISOString(),
        '',
      ],
    ]);
    upload['!cols'] = HEADERS.map((header) => ({
      wch: ['productOfferingId', 'marketId', 'observedAt', 'notes'].includes(
        header,
      )
        ? 36
        : 22,
    }));
    upload['!autofilter'] = { ref: `A1:L2` };
    XLSX.utils.book_append_sheet(workbook, upload, UPLOAD_SHEET);

    const offeringsSheet = XLSX.utils.json_to_sheet(
      offerings.map((offering) => ({
        productOfferingId: offering.id,
        productOfferingSku: offering.sku,
        productName: offering.product.name,
        productSku: offering.product.sku,
        variant: offering.variant?.name ?? '',
        brand: offering.brand?.name ?? '',
        packageName: offering.package.name,
        packageType: offering.package.packageType,
        baseUnit: offering.package.baseUnit ?? '',
        quantity: this.decimalNumber(offering.package.quantity) ?? '',
      })),
      {
        header: [
          'productOfferingId',
          'productOfferingSku',
          'productName',
          'productSku',
          'variant',
          'brand',
          'packageName',
          'packageType',
          'baseUnit',
          'quantity',
        ],
      },
    );
    offeringsSheet['!cols'] = [
      { wch: 38 },
      { wch: 30 },
      { wch: 28 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(workbook, offeringsSheet, 'Offerings');

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
      ['priceUnit', `${lookup.activeCodes().join(', ')} (optional)`],
      ['qualityGrade', Object.values(PriceQualityGrade).join(', ')],
      ['source', Object.values(PriceSource).join(', ')],
      ['currency', 'NGN (or another 3-letter currency code)'],
    ]);
    values['!cols'] = [{ wch: 22 }, { wch: 90 }];
    XLSX.utils.book_append_sheet(workbook, values, 'Allowed Values');

    const instructions = XLSX.utils.aoa_to_sheet([
      ['Rule', 'Explanation'],
      [
        'One row = one market price',
        'Each row creates one observed price for one offering in one market.',
      ],
      [
        'Offering',
        'Supply either productOfferingSku or productOfferingId. If both are supplied, they must identify the same offering.',
      ],
      [
        'Market',
        'Supply either marketName or marketId. If both are supplied, they must identify the same market.',
      ],
      [
        'priceUnit',
        'Leave blank to derive the unit from the offering package. If supplied, it must match the package-derived unit.',
      ],
      [
        'Safe import',
        'Call /validate first. /commit validates the workbook again and writes all rows in one transaction.',
      ],
    ]);
    instructions['!cols'] = [{ wch: 24 }, { wch: 115 }];
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
        productOfferingSku: row.productOfferingSku,
        marketName: row.marketName,
        amount: row.amount,
        unit: row.unitCode,
        observedAt: row.observedAt.toISOString(),
      })),
    };
  }

  async commit(file?: Express.Multer.File) {
    const analysis = await this.analyze(file);
    if (analysis.errors.length) {
      throw new BadRequestException({
        message: 'Market price upload validation failed. No data was written.',
        summary: analysis.summary,
        errors: analysis.errors,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.marketPrice.createMany({
        data: analysis.rows.map((row) => ({
          productId: row.productId,
          productOfferingId: row.productOfferingId,
          marketId: row.marketId,
          amount: row.amount,
          currency: row.currency,
          priceUnitId: row.priceUnitId,
          quantity: row.quantity,
          qualityGrade: row.qualityGrade,
          source: row.source,
          observedAt: row.observedAt,
          notes: row.notes,
        })),
      });
    });

    return {
      message: 'Market prices imported successfully.',
      summary: {
        ...analysis.summary,
        pricesCreated: analysis.rows.length,
      },
    };
  }

  private async analyze(file?: Express.Multer.File): Promise<Analysis> {
    if (!file) {
      throw new BadRequestException('Market price upload file is required');
    }
    const rawRows = this.readRows(file);
    if (!rawRows.length) {
      throw new BadRequestException('Market price upload file contains no rows');
    }
    if (rawRows.length > MAX_ROWS) {
      throw new BadRequestException(
        `Market price upload cannot exceed ${MAX_ROWS} rows`,
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
      summary: {
        rowsReceived: rawRows.length,
        rowsValid: rows.length,
        errors: errors.length,
      },
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
        throw new BadRequestException('Market price upload file has no sheets');
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
        'Market price upload could not be parsed. Upload a valid .xlsx, .xls, or .csv file',
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
    const offering = this.resolveOffering(raw, rowNumber, existing, errors);
    const market = this.resolveMarket(raw, rowNumber, existing, errors);
    const amount = this.positiveNumber(raw.amount, rowNumber, 'amount', errors);
    const currency = (raw.currency?.trim() || 'NGN').toUpperCase();
    const observedAt = this.dateValue(
      raw.observedAt,
      rowNumber,
      'observedAt',
      errors,
    );
    const requestedUnit = this.requestedPriceUnit(
      raw.priceUnit,
      lookup,
      rowNumber,
      errors,
    );
    const qualityGrade =
      this.enumValue(
        PriceQualityGrade,
        raw.qualityGrade || PriceQualityGrade.standard,
        rowNumber,
        'qualityGrade',
        errors,
      ) ?? PriceQualityGrade.standard;
    const source =
      this.enumValue(
        PriceSource,
        raw.source || PriceSource.manual,
        rowNumber,
        'source',
        errors,
      ) ?? PriceSource.manual;
    const quantity = this.positiveNumber(
      raw.quantity,
      rowNumber,
      'quantity',
      errors,
      true,
    );

    if (!/^[A-Z]{3}$/.test(currency)) {
      errors.push({
        row: rowNumber,
        field: 'currency',
        message: 'currency must be a 3-letter code such as NGN',
      });
    }

    let priceUnit: ReturnType<PriceUnitLookup['resolveFromPackage']>;
    if (offering) {
      priceUnit = this.resolvePriceUnit(
        requestedUnit,
        offering.package,
        lookup,
        rowNumber,
        errors,
      );
    }

    if (
      errors.length > before ||
      !offering ||
      !market ||
      amount === undefined ||
      !observedAt ||
      !priceUnit
    ) {
      return undefined;
    }

    return {
      rowNumber,
      productId: offering.productId,
      productOfferingId: offering.id,
      productOfferingSku: offering.sku,
      marketId: market.id,
      marketName: market.marketname,
      amount,
      currency,
      priceUnitId: priceUnit.id,
      unitCode: priceUnit.code,
      quantity,
      qualityGrade,
      source,
      observedAt,
      notes: raw.notes?.trim() || undefined,
    };
  }

  private validateFileConsistency(
    rows: ParsedRow[],
    existing: ExistingData,
    errors: UploadError[],
  ) {
    const rowsByIdentity = new Set<string>();

    for (const row of rows) {
      const key = `${row.productOfferingId}|${row.marketId}|${row.observedAt.toISOString()}`;
      if (rowsByIdentity.has(key)) {
        errors.push({
          row: row.rowNumber,
          field: 'observedAt',
          message:
            'Duplicate row for the same offering, market and observedAt',
        });
      }
      rowsByIdentity.add(key);

      if (existing.marketPrices.has(key)) {
        errors.push({
          row: row.rowNumber,
          field: 'observedAt',
          message:
            'A market price already exists for this offering, market and observedAt',
        });
      }
    }
  }

  private async loadExisting() {
    const [offeringList, marketList, marketPriceList] = await Promise.all([
      this.prisma.productOffering.findMany({
        where: { isActive: true, product: { status: 'active' } },
        select: {
          id: true,
          sku: true,
          productId: true,
          package: true,
        },
      }),
      this.prisma.market.findMany({
        where: { status: 'active' },
        select: { id: true, marketname: true },
      }),
      this.prisma.marketPrice.findMany({
        select: {
          productOfferingId: true,
          marketId: true,
          observedAt: true,
        },
      }),
    ]);

    return {
      offeringList,
      marketList,
      offerings: new Map(
        offeringList.flatMap((item) => [
          [this.key(item.id), item],
          [this.key(item.sku), item],
        ]),
      ),
      markets: new Map(
        marketList.flatMap((item) => [
          [this.key(item.id), item],
          [this.key(item.marketname), item],
        ]),
      ),
      marketPrices: new Set(
        marketPriceList
          .filter((item) => item.productOfferingId)
          .map(
            (item) =>
              `${item.productOfferingId}|${item.marketId}|${item.observedAt.toISOString()}`,
          ),
      ),
    };
  }

  private resolveOffering(
    raw: RawRow,
    rowNumber: number,
    existing: ExistingData,
    errors: UploadError[],
  ): ExistingData['offeringList'][number] | undefined {
    const bySku = raw.productOfferingSku
      ? existing.offerings.get(this.key(raw.productOfferingSku))
      : undefined;
    const byId = raw.productOfferingId
      ? existing.offerings.get(this.key(raw.productOfferingId))
      : undefined;

    if (!raw.productOfferingSku && !raw.productOfferingId) {
      errors.push({
        row: rowNumber,
        field: 'productOfferingSku',
        message: 'productOfferingSku or productOfferingId is required',
      });
      return undefined;
    }
    if (raw.productOfferingSku && !bySku) {
      errors.push({
        row: rowNumber,
        field: 'productOfferingSku',
        message: `Active product offering "${raw.productOfferingSku}" was not found`,
      });
    }
    if (raw.productOfferingId && !byId) {
      errors.push({
        row: rowNumber,
        field: 'productOfferingId',
        message: `Active product offering "${raw.productOfferingId}" was not found`,
      });
    }
    if (bySku && byId && bySku.id !== byId.id) {
      errors.push({
        row: rowNumber,
        field: 'productOfferingId',
        message:
          'productOfferingSku and productOfferingId identify different offerings',
      });
    }

    return bySku ?? byId;
  }

  private resolveMarket(
    raw: RawRow,
    rowNumber: number,
    existing: ExistingData,
    errors: UploadError[],
  ): ExistingData['marketList'][number] | undefined {
    const byName = raw.marketName
      ? existing.markets.get(this.key(raw.marketName))
      : undefined;
    const byId = raw.marketId
      ? existing.markets.get(this.key(raw.marketId))
      : undefined;

    if (!raw.marketName && !raw.marketId) {
      errors.push({
        row: rowNumber,
        field: 'marketName',
        message: 'marketName or marketId is required',
      });
      return undefined;
    }
    if (raw.marketName && !byName) {
      errors.push({
        row: rowNumber,
        field: 'marketName',
        message: `Active market "${raw.marketName}" was not found`,
      });
    }
    if (raw.marketId && !byId) {
      errors.push({
        row: rowNumber,
        field: 'marketId',
        message: `Active market "${raw.marketId}" was not found`,
      });
    }
    if (byName && byId && byName.id !== byId.id) {
      errors.push({
        row: rowNumber,
        field: 'marketId',
        message: 'marketName and marketId identify different markets',
      });
    }

    return byName ?? byId;
  }

  private requestedPriceUnit(
    value: string | undefined,
    lookup: PriceUnitLookup,
    rowNumber: number,
    errors: UploadError[],
  ): ReturnType<PriceUnitLookup['getByCode']> {
    const normalized = value?.trim();
    if (!normalized) return undefined;
    const unit = lookup.getByCode(normalized);
    if (!unit || !unit.isActive) {
      errors.push({
        row: rowNumber,
        field: 'priceUnit',
        message: `priceUnit must be one of: ${lookup.activeCodes().join(', ')}`,
      });
      return undefined;
    }
    return unit;
  }

  private resolvePriceUnit(
    requestedUnit: ReturnType<PriceUnitLookup['getByCode']>,
    productPackage: ProductPackage,
    lookup: PriceUnitLookup,
    rowNumber: number,
    errors: UploadError[],
  ): ReturnType<PriceUnitLookup['resolveFromPackage']> {
    const packageUnit = lookup.resolveFromPackage(productPackage);
    if (!packageUnit) {
      errors.push({
        row: rowNumber,
        field: 'priceUnit',
        message: `Could not derive priceUnit from package "${productPackage.name}"`,
      });
      return undefined;
    }

    if (requestedUnit && requestedUnit.id !== packageUnit.id) {
      errors.push({
        row: rowNumber,
        field: 'priceUnit',
        message: `priceUnit ${requestedUnit.code} does not match offering package unit ${packageUnit.code}`,
      });
      return undefined;
    }

    return requestedUnit ?? packageUnit;
  }

  private enumValue<T extends Record<string, string>>(
    enumObject: T,
    value: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
    optional = false,
  ): T[keyof T] | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      if (!optional) {
        errors.push({ row, field, message: `${field} is required` });
      }
      return undefined;
    }
    if (Object.values(enumObject).includes(normalized)) {
      return normalized as T[keyof T];
    }
    errors.push({
      row,
      field,
      message: `${field} must be one of: ${Object.values(enumObject).join(', ')}`,
    });
    return undefined;
  }

  private positiveNumber(
    value: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
    optional = false,
  ): number | undefined {
    const normalized = value?.trim();
    if (!normalized) {
      if (!optional) {
        errors.push({ row, field, message: `${field} is required` });
      }
      return undefined;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors.push({
        row,
        field,
        message: `${field} must be a positive number`,
      });
      return undefined;
    }
    return parsed;
  }

  private dateValue(
    value: string | undefined,
    row: number,
    field: Header,
    errors: UploadError[],
  ): Date | undefined {
    if (!value?.trim()) {
      errors.push({ row, field, message: `${field} is required` });
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({
        row,
        field,
        message: `${field} must be a valid date or ISO datetime`,
      });
      return undefined;
    }
    return parsed;
  }

  private decimalNumber(value: Prisma.Decimal | number | null): number | undefined {
    if (value === null) return undefined;
    return typeof value === 'number' ? value : value.toNumber();
  }

  private key(value: string) {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }
}
