import { Injectable } from '@nestjs/common';
import { BuyPrice, Prisma, Product, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuoteOrderItemDto } from './dto/quote-order.dto';

type CatalogPrice = BuyPrice & { product: Product };

export type NormalizedQuoteItemStatus =
  | 'matched'
  | 'needs_confirmation'
  | 'unsupported_unit'
  | 'product_not_found'
  | 'invalid_quantity';

export type NormalizedQuoteItem = {
  original: string;
  status: NormalizedQuoteItemStatus;
  interpretation: {
    product?: string;
    quantity?: number;
    unit?: string;
  };
  availableUnits: string[];
  suggestedProducts?: string[];
  buyPriceId?: string;
  unitPrice?: number;
  totalPrice?: number;
  message: string;
};

export type NormalizedOrderText = {
  items: NormalizedQuoteItem[];
  quoteItems: QuoteOrderItemDto[];
  canProceed: boolean;
  summary: {
    received: number;
    matched: number;
    requiresAttention: number;
  };
};

const UNIT_ALIASES: Record<string, string[]> = {
  kg: ['kg', 'kgs', 'kilogram', 'kilograms'],
  bag: ['bag', 'bags'],
  basket: ['basket', 'baskets'],
  paint_bucket: [
    'paint bucket',
    'paint buckets',
    'paint rubber',
    'paint rubbers',
  ],
  crate: ['crate', 'crates'],
  litre: ['litre', 'litres', 'liter', 'liters', 'l'],
  bottle: ['bottle', 'bottles'],
  bunch: ['bunch', 'bunches'],
  piece: ['piece', 'pieces', 'pcs', 'pc'],
  derica: ['derica', 'dericas'],
  cup: ['cup', 'cups'],
};

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

@Injectable()
export class OrderQuoteNormalizerService {
  constructor(private readonly prisma: PrismaService) {}

  async normalize(orderText: string): Promise<NormalizedOrderText> {
    const catalog = await this.getCatalog();
    const parts = orderText
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const items = parts.map((part) => this.normalizeItem(part, catalog));
    const quoteItems = items
      .filter(
        (
          item,
        ): item is NormalizedQuoteItem & {
          buyPriceId: string;
          interpretation: { quantity: number };
        } =>
          item.status === 'matched' &&
          Boolean(item.buyPriceId) &&
          typeof item.interpretation.quantity === 'number',
      )
      .map((item) => ({
        buyPriceId: item.buyPriceId,
        quantity: item.interpretation.quantity,
      }));
    const matched = quoteItems.length;

    return {
      items,
      quoteItems,
      canProceed: parts.length > 0 && matched === parts.length,
      summary: {
        received: parts.length,
        matched,
        requiresAttention: parts.length - matched,
      },
    };
  }

  private async getCatalog(): Promise<CatalogPrice[]> {
    const now = new Date();

    return this.prisma.buyPrice.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        product: { status: ProductStatus.active },
      },
      include: { product: true },
      orderBy: [{ finalPrice: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  private normalizeItem(
    original: string,
    catalog: CatalogPrice[],
  ): NormalizedQuoteItem {
    const cleaned = this.clean(original);
    const quantityResult = this.parseQuantity(cleaned);

    if (!quantityResult.valid) {
      return {
        original,
        status: 'invalid_quantity',
        interpretation: {},
        availableUnits: [],
        message: quantityResult.message,
      };
    }

    const unitResult = this.parseUnit(quantityResult.remainder);
    const productText = this.clean(unitResult.remainder.replace(/^of\s+/, ''));
    const productMatch = this.matchProduct(productText, catalog);

    if (!productMatch.product) {
      return {
        original,
        status: productMatch.suggestions.length
          ? 'needs_confirmation'
          : 'product_not_found',
        interpretation: {
          product: productText || undefined,
          quantity: quantityResult.quantity,
          unit: unitResult.unit,
        },
        availableUnits: [],
        suggestedProducts: productMatch.suggestions,
        message: productMatch.suggestions.length
          ? `We could not confidently identify "${productText}". Did you mean ${this.joinWords(productMatch.suggestions)}?`
          : `We could not find "${productText}" in the active product catalog.`,
      };
    }

    const productPrices = catalog.filter(
      (price) => price.productId === productMatch.product?.id,
    );
    const availableUnits = [
      ...new Set(productPrices.map((price) => price.unit)),
    ];

    if (!unitResult.unit) {
      return {
        original,
        status: 'needs_confirmation',
        interpretation: {
          product: productMatch.product.name,
          quantity: quantityResult.quantity,
        },
        availableUnits,
        message: `${productMatch.product.name} was found, but no unit was recognized. Available units are ${this.joinWords(availableUnits)}.`,
      };
    }

    const price = productPrices.find(
      (candidate) => candidate.unit === unitResult.unit,
    );

    if (!price) {
      return {
        original,
        status: 'unsupported_unit',
        interpretation: {
          product: productMatch.product.name,
          quantity: quantityResult.quantity,
          unit: unitResult.unit,
        },
        availableUnits,
        message: `${productMatch.product.name} is not currently available in ${this.displayUnit(unitResult.unit)}. Available units are ${this.joinWords(availableUnits)}.`,
      };
    }

    const unitPrice = this.toNumber(price.finalPrice);
    const totalPrice = this.roundMoney(unitPrice * quantityResult.quantity);

    return {
      original,
      status: 'matched',
      interpretation: {
        product: productMatch.product.name,
        quantity: quantityResult.quantity,
        unit: price.unit,
      },
      availableUnits,
      buyPriceId: price.id,
      unitPrice,
      totalPrice,
      message: `Matched ${this.formatQuantity(quantityResult.quantity)} ${this.displayUnit(price.unit)} of ${productMatch.product.name}.`,
    };
  }

  private parseQuantity(
    value: string,
  ):
    | { valid: true; quantity: number; remainder: string }
    | { valid: false; message: string } {
    const fraction = value.match(/^(\d+)\s*\/\s*(\d+)\b/);

    if (fraction) {
      const normalized = `${fraction[1]}/${fraction[2]}`;
      const quantity =
        normalized === '1/2' ? 0.5 : normalized === '1/4' ? 0.25 : 0;

      if (!quantity) {
        return {
          valid: false,
          message: `The fraction ${normalized} is not supported. Only 1/2 and 1/4 are allowed.`,
        };
      }

      return {
        valid: true,
        quantity,
        remainder: value.slice(fraction[0].length).trim(),
      };
    }

    const wordFraction = value.match(/^(?:a\s+)?(half|quarter)\b/);
    if (wordFraction) {
      return {
        valid: true,
        quantity: wordFraction[1] === 'half' ? 0.5 : 0.25,
        remainder: value
          .slice(wordFraction[0].length)
          .trim()
          .replace(/^a\s+/, ''),
      };
    }

    const numeric = value.match(/^(\d+(?:\.\d+)?)\b/);
    if (numeric) {
      const quantity = Number(numeric[1]);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return {
          valid: false,
          message: 'Quantity must be a positive whole number, 1/2, or 1/4.',
        };
      }

      return {
        valid: true,
        quantity,
        remainder: value.slice(numeric[0].length).trim(),
      };
    }

    const firstWord = value.split(/\s+/)[0];
    const wordQuantity = NUMBER_WORDS[firstWord];
    if (wordQuantity) {
      return {
        valid: true,
        quantity: wordQuantity,
        remainder: value.slice(firstWord.length).trim(),
      };
    }

    return {
      valid: false,
      message:
        'A quantity is required. Use a positive whole number, 1/2, or 1/4.',
    };
  }

  private parseUnit(value: string): { unit?: string; remainder: string } {
    const words = value.split(/\s+/);
    const candidates = [words.slice(0, 2).join(' '), words[0]].filter(Boolean);
    let best:
      | { unit: string; consumedWords: number; score: number }
      | undefined;

    for (const candidate of candidates) {
      for (const [unit, aliases] of Object.entries(UNIT_ALIASES)) {
        for (const alias of aliases) {
          const score = this.similarity(candidate, alias);
          const exact = candidate === alias;

          if ((exact || score >= 0.72) && (!best || score > best.score)) {
            best = {
              unit,
              consumedWords: candidate.split(' ').length,
              score,
            };
          }
        }
      }
    }

    if (!best) {
      return { remainder: value };
    }

    return {
      unit: best.unit,
      remainder: words.slice(best.consumedWords).join(' '),
    };
  }

  private matchProduct(
    value: string,
    catalog: CatalogPrice[],
  ): { product?: Product; suggestions: string[] } {
    const products = [
      ...new Map(
        catalog.map((price) => [price.product.id, price.product]),
      ).values(),
    ];
    const ranked = products
      .map((product) => {
        const name = this.clean(product.name);
        const exact = name === value;
        const contained = name.includes(value) || value.includes(name);
        return {
          product,
          score: exact ? 1 : contained ? 0.9 : this.similarity(value, name),
        };
      })
      .sort((first, second) => second.score - first.score);
    const best = ranked[0];

    if (!best || best.score < 0.62) {
      return { suggestions: [] };
    }

    const suggestions = ranked
      .filter((match) => match.score >= Math.max(0.62, best.score - 0.08))
      .slice(0, 3)
      .map((match) => match.product.name);

    if (
      suggestions.length > 1 &&
      ranked[1] &&
      best.score - ranked[1].score < 0.08
    ) {
      return { suggestions };
    }

    return { product: best.product, suggestions: [] };
  }

  private clean(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9/\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private similarity(first: string, second: string): number {
    if (first === second) return 1;
    const longest = Math.max(first.length, second.length);
    if (!longest) return 1;
    return 1 - this.levenshtein(first, second) / longest;
  }

  private levenshtein(first: string, second: string): number {
    const previous = Array.from({ length: second.length + 1 }, (_, i) => i);

    for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
      const current = [firstIndex];
      for (
        let secondIndex = 1;
        secondIndex <= second.length;
        secondIndex += 1
      ) {
        current[secondIndex] = Math.min(
          current[secondIndex - 1] + 1,
          previous[secondIndex] + 1,
          previous[secondIndex - 1] +
            (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1),
        );
      }
      previous.splice(0, previous.length, ...current);
    }

    return previous[second.length];
  }

  private displayUnit(unit: string): string {
    return unit.replace(/_/g, ' ');
  }

  private joinWords(values: string[]): string {
    const displayed = values.map((value) => this.displayUnit(value));
    if (displayed.length === 0) return 'none';
    if (displayed.length === 1) return displayed[0];
    return `${displayed.slice(0, -1).join(', ')} and ${displayed.at(-1)}`;
  }

  private formatQuantity(quantity: number): string {
    if (quantity === 0.5) return '1/2';
    if (quantity === 0.25) return '1/4';
    return quantity.toString();
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
