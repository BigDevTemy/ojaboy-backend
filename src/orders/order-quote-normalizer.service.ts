import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BuyPrice,
  PriceUnit,
  Prisma,
  Product,
  ProductStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { PriceUnitLookup } from '../price-units/price-unit-lookup';
import { QuoteOrderItemDto } from './dto/quote-order.dto';
import { ResolveQuoteChoiceDto } from './dto/resolve-quote-choice.dto';

type CatalogPrice = BuyPrice & {
  product: Product;
  productOffering?: {
    id: string;
    sku: string;
    variant: { id: string; name: string } | null;
    brand: { id: string; name: string } | null;
    package: { id: string; name: string };
  } | null;
  priceUnit: PriceUnit;
};

export type NormalizedQuoteChoice = {
  buyPriceId: string;
  productOfferingId?: string;
  label: string;
  unit: string;
  unitPrice: number;
};

export type NormalizedQuoteItemStatus =
  | 'matched'
  | 'matched_amount'
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
    amount?: number;
  };
  availableUnits: string[];
  choices?: NormalizedQuoteChoice[];
  suggestedProducts?: string[];
  buyPriceId?: string;
  productId?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async normalize(orderText: string): Promise<NormalizedOrderText> {
    const [catalog, activeProducts, lookup] = await Promise.all([
      this.getCatalog(),
      this.getActiveProducts(),
      this.priceUnitsService.getLookup(),
    ]);
    const parts = orderText
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const items = parts.map((part) =>
      this.normalizeItem(part, catalog, activeProducts, lookup),
    );
    const quoteItems = items
      .map((item): QuoteOrderItemDto | undefined => {
        if (
          item.status === 'matched' &&
          item.buyPriceId &&
          typeof item.interpretation.quantity === 'number'
        ) {
          return {
            buyPriceId: item.buyPriceId,
            quantity: item.interpretation.quantity,
          };
        }
        if (
          item.status === 'matched_amount' &&
          item.productId &&
          typeof item.interpretation.amount === 'number'
        ) {
          return {
            productId: item.productId,
            amount: item.interpretation.amount,
          };
        }
        return undefined;
      })
      .filter((item): item is QuoteOrderItemDto => Boolean(item));
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

  /**
   * Resolves a single needs_confirmation line once the customer has picked
   * one of its `choices` - the frontend sends back just that one buyPriceId
   * + quantity instead of resubmitting the whole orderText for
   * re-normalization. Returns the same shape normalize() would have
   * produced for that line had it matched outright.
   */
  async resolveChoice(
    dto: ResolveQuoteChoiceDto,
  ): Promise<NormalizedQuoteItem> {
    const now = new Date();
    const price = await this.prisma.buyPrice.findUnique({
      where: { id: dto.buyPriceId },
      include: {
        product: true,
        productOffering: {
          include: { variant: true, brand: true, package: true },
        },
        priceUnit: true,
      },
    });

    if (
      !price ||
      !price.isActive ||
      price.validFrom > now ||
      price.product.status !== ProductStatus.active
    ) {
      throw new BadRequestException(
        `Buy price ${dto.buyPriceId} is not currently available`,
      );
    }

    const unitPrice = this.toNumber(price.finalPrice);
    const totalPrice = this.roundMoney(unitPrice * dto.quantity);

    return {
      original: dto.original ?? '',
      status: 'matched',
      interpretation: {
        product: price.product.name,
        quantity: dto.quantity,
        unit: price.priceUnit.code,
      },
      availableUnits: [price.priceUnit.code],
      buyPriceId: price.id,
      unitPrice,
      totalPrice,
      message: `Matched ${this.formatQuantity(dto.quantity)} ${this.displayUnit(price.priceUnit.code)} of ${price.product.name}.`,
    };
  }

  /**
   * Market prices are only re-uploaded when they change, so an active
   * BuyPrice with a validUntil in the past is still the correct price -
   * it just hasn't been superseded because nothing changed. Only isActive
   * (flipped false when a newer price supersedes it) and validFrom (don't
   * use a price before its scheduled start) gate whether a price applies.
   */
  private async getCatalog(): Promise<CatalogPrice[]> {
    const now = new Date();

    return this.prisma.buyPrice.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        product: { status: ProductStatus.active },
      },
      include: {
        product: true,
        productOffering: {
          include: {
            variant: true,
            brand: true,
            package: true,
          },
        },
        priceUnit: true,
      },
      orderBy: [{ finalPrice: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  /**
   * Amount-based lines ("N2000 tomatoes") only need to identify the
   * product, not a specific offering or price - so they must resolve
   * against every active product, not just ones with a generated BuyPrice.
   * A freshly catalogued product with no BuyPrice yet is still a valid
   * target for an amount-based line.
   */
  private async getActiveProducts(): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.active },
    });
  }

  private normalizeItem(
    original: string,
    catalog: CatalogPrice[],
    activeProducts: Product[],
    lookup: PriceUnitLookup,
  ): NormalizedQuoteItem {
    const explicitAmount = this.parseAmount(original);
    if (explicitAmount) {
      return this.resolveAmountItem(
        original,
        explicitAmount.amount,
        explicitAmount.productText,
        activeProducts,
      );
    }

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

    const unitResult = this.parseUnit(quantityResult.remainder, lookup);

    if (!unitResult.unit) {
      const unitAttempt = this.detectUnrecognizedUnit(
        quantityResult.remainder,
        activeProducts,
      );

      if (unitAttempt) {
        return this.unsupportedUnitItem(
          original,
          unitAttempt.product,
          quantityResult.quantity,
          unitAttempt.attemptedUnit,
          catalog,
        );
      }

      // No recognizable unit at all: read the leading number as a Naira
      // amount instead of a quantity, e.g. "400 onions" -> N400 of onions.
      const productText = this.clean(
        quantityResult.remainder.replace(/^of\s+/, ''),
      );
      return this.resolveAmountItem(
        original,
        quantityResult.quantity,
        productText,
        activeProducts,
      );
    }

    const productText = this.clean(unitResult.remainder.replace(/^of\s+/, ''));
    const productMatch = this.matchProduct(
      productText,
      catalog.map((price) => price.product),
    );

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
      ...new Set(productPrices.map((price) => price.priceUnit.code)),
    ];
    const matchingUnitPrices = productPrices.filter(
      (candidate) => candidate.priceUnit.code === unitResult.unit,
    );

    if (matchingUnitPrices.length === 0) {
      return this.unsupportedUnitItem(
        original,
        productMatch.product,
        quantityResult.quantity,
        unitResult.unit,
        catalog,
      );
    }

    const resolved = this.resolvePriceCandidate(
      this.clean(
        [unitResult.packageHint, productText].filter(Boolean).join(' '),
      ),
      matchingUnitPrices,
    );

    if (!resolved.price) {
      return {
        original,
        status: 'needs_confirmation',
        interpretation: {
          product: productMatch.product.name,
          quantity: quantityResult.quantity,
          unit: unitResult.unit,
        },
        availableUnits,
        choices: resolved.choices,
        message: `${productMatch.product.name} has multiple ${this.displayUnit(unitResult.unit)} offerings. Please choose one.`,
      };
    }

    const price = resolved.price;
    const unitPrice = this.toNumber(price.finalPrice);
    const totalPrice = this.roundMoney(unitPrice * quantityResult.quantity);

    return {
      original,
      status: 'matched',
      interpretation: {
        product: productMatch.product.name,
        quantity: quantityResult.quantity,
        unit: price.priceUnit.code,
      },
      availableUnits,
      buyPriceId: price.id,
      unitPrice,
      totalPrice,
      message: `Matched ${this.formatQuantity(quantityResult.quantity)} ${this.displayUnit(price.priceUnit.code)} of ${productMatch.product.name}.`,
    };
  }

  /**
   * Amount-based line: the customer stated a Naira budget instead of a
   * quantity+unit (e.g. "N2000 tomatoes", or "400 onions" with no unit at
   * all). No price is calculated - the stated amount becomes the line's
   * total directly. Only the product needs to be identified.
   */
  private resolveAmountItem(
    original: string,
    amount: number,
    productText: string,
    activeProducts: Product[],
  ): NormalizedQuoteItem {
    const productMatch = this.matchProduct(productText, activeProducts);

    if (!productMatch.product) {
      return {
        original,
        status: productMatch.suggestions.length
          ? 'needs_confirmation'
          : 'product_not_found',
        interpretation: {
          product: productText || undefined,
          amount,
        },
        availableUnits: [],
        suggestedProducts: productMatch.suggestions,
        message: productMatch.suggestions.length
          ? `We could not confidently identify "${productText}". Did you mean ${this.joinWords(productMatch.suggestions)}?`
          : `We could not find "${productText}" in the active product catalog.`,
      };
    }

    return {
      original,
      status: 'matched_amount',
      interpretation: {
        product: productMatch.product.name,
        amount,
      },
      availableUnits: [],
      productId: productMatch.product.id,
      totalPrice: this.roundMoney(amount),
      message: `Matched ${this.formatMoney(amount)} worth of ${productMatch.product.name}. The exact quantity will be decided at fulfillment.`,
    };
  }

  private resolvePriceCandidate(
    productText: string,
    prices: CatalogPrice[],
  ): { price?: CatalogPrice; choices?: NormalizedQuoteChoice[] } {
    if (prices.length === 1) {
      return { price: prices[0] };
    }

    const detailed = prices.filter((price) => price.productOffering);
    const legacy = prices.filter((price) => !price.productOffering);

    if (detailed.length === 0) {
      return { price: legacy[0] };
    }

    const ranked = detailed
      .map((price) => ({
        price,
        score: this.offeringMatchScore(productText, price),
      }))
      .sort((first, second) => second.score - first.score);
    const best = ranked[0];
    const second = ranked[1];

    if (best && best.score > 0 && (!second || best.score - second.score >= 1)) {
      return { price: best.price };
    }

    return {
      choices: prices.map((price) => this.toChoice(price)),
    };
  }

  private offeringMatchScore(productText: string, price: CatalogPrice): number {
    const offering = price.productOffering;
    if (!offering) return 0;

    return [
      offering.variant?.name,
      offering.brand?.name,
      offering.package.name,
      offering.sku,
    ].reduce((score, value) => {
      if (!value) return score;
      const normalized = this.clean(value);
      return productText.includes(normalized) ? score + 1 : score;
    }, 0);
  }

  private toChoice(price: CatalogPrice): NormalizedQuoteChoice {
    return {
      buyPriceId: price.id,
      productOfferingId: price.productOfferingId ?? undefined,
      label: this.offeringLabel(price),
      unit: price.priceUnit.code,
      unitPrice: this.toNumber(price.finalPrice),
    };
  }

  private offeringLabel(price: CatalogPrice): string {
    const offering = price.productOffering;
    if (!offering) {
      return `${price.product.name} — ${this.displayUnit(price.priceUnit.code)}`;
    }

    return [
      offering.brand?.name,
      offering.variant?.name,
      price.product.name,
      offering.package.name,
    ]
      .filter(Boolean)
      .join(' — ');
  }

  /**
   * Detects an explicit Naira amount marker ("N2000", "₦2,000", "NGN 2000")
   * at the start of a line. This is the unambiguous signal for an
   * amount-based line; the other signal (a bare number with no recognized
   * unit) is handled separately in normalizeItem once unit-parsing fails.
   */
  private parseAmount(
    value: string,
  ): { amount: number; productText: string } | undefined {
    const match = value.trim().match(/^(?:₦|N|NGN)\s*([\d,]+(?:\.\d+)?)\s*(.*)$/i);
    if (!match) return undefined;

    const amount = Number(match[1].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return undefined;

    return {
      amount,
      productText: this.clean(match[2].replace(/^of\s+/i, '')),
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

  private parseUnit(
    value: string,
    lookup: PriceUnitLookup,
  ): {
    unit?: string;
    packageHint?: string;
    remainder: string;
  } {
    const sizedPackage = value.match(
      /^(\d+(?:\.\d+)?)\s*(kg|g|litres?|liters?|l|ml)\s+(bags?|baskets?|buckets?|crates?|bottles?)\b/,
    );
    if (sizedPackage) {
      const unit = lookup.resolveByName(sizedPackage[3])?.code;
      if (unit) {
        return {
          unit,
          packageHint: sizedPackage[0],
          remainder: value.slice(sizedPackage[0].length).trim(),
        };
      }
    }

    const words = value.split(/\s+/);
    const candidates = [words.slice(0, 2).join(' '), words[0]].filter(Boolean);
    const activeUnits = lookup.all().filter((unit) => unit.isActive);
    let best:
      | { unit: string; consumedWords: number; score: number }
      | undefined;

    for (const candidate of candidates) {
      for (const unit of activeUnits) {
        const aliasCandidates = [
          unit.code.replace(/_/g, ' '),
          ...unit.aliases.map((alias) => alias.replace(/_/g, ' ')),
        ];

        for (const alias of aliasCandidates) {
          const score = this.similarity(candidate, alias);
          const exact = candidate === alias;

          if ((exact || score >= 0.72) && (!best || score > best.score)) {
            best = {
              unit: unit.code,
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
    candidates: Product[],
  ): { product?: Product; suggestions: string[] } {
    const products = [
      ...new Map(candidates.map((product) => [product.id, product])).values(),
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

  /**
   * When parseUnit finds no recognized leading unit word, the remainder
   * might still be "<unrecognized unit> <product>" (e.g. "kobiowu of rice")
   * rather than a bare product name (e.g. "onions"). Detect that shape by
   * checking whether dropping 1-2 leading words turns a non-match into a
   * confident product match - if so, the dropped words are what the
   * customer meant as a unit, and this should surface as unsupported_unit
   * (with the product's real available units) instead of silently falling
   * through to amount-mode and pricing the leading number as a Naira value.
   */
  private detectUnrecognizedUnit(
    remainder: string,
    activeProducts: Product[],
  ): { product: Product; attemptedUnit: string } | undefined {
    const words = this.clean(remainder)
      .split(/\s+/)
      .filter((word) => word && word !== 'of');

    if (words.length < 2) {
      return undefined;
    }

    if (this.matchProductStrict(words.join(' '), activeProducts)) {
      return undefined;
    }

    for (const dropCount of [1, 2]) {
      if (dropCount >= words.length) break;

      const product = this.matchProductStrict(
        words.slice(dropCount).join(' '),
        activeProducts,
      );

      if (product) {
        return {
          product,
          attemptedUnit: words.slice(0, dropCount).join(' '),
        };
      }
    }

    return undefined;
  }

  /**
   * Stricter than matchProduct(): only an exact clean match, a confident
   * typo-tolerant match, or the product's real name containing a shorter
   * typed value (prefix typing) count. Deliberately excludes matchProduct's
   * "value.includes(name)" shortcut - that lets any noisy multi-word string
   * that merely contains a product name as a substring match with high
   * confidence, which is what let "kobiowu of rice" match Rice outright.
   */
  private matchProductStrict(
    value: string,
    products: Product[],
  ): Product | undefined {
    const unique = [
      ...new Map(products.map((product) => [product.id, product])).values(),
    ];
    const ranked = unique
      .map((product) => {
        const name = this.clean(product.name);
        const exact = name === value;
        const prefixContained =
          !exact && name.length > value.length && name.includes(value);
        return {
          product,
          score: exact ? 1 : prefixContained ? 0.85 : this.similarity(value, name),
        };
      })
      .sort((first, second) => second.score - first.score);
    const best = ranked[0];

    if (!best || best.score < 0.72) {
      return undefined;
    }

    const runnerUp = ranked[1];
    if (runnerUp && best.score - runnerUp.score < 0.08) {
      return undefined;
    }

    return best.product;
  }

  private unsupportedUnitItem(
    original: string,
    product: Product,
    quantity: number,
    attemptedUnit: string,
    catalog: CatalogPrice[],
  ): NormalizedQuoteItem {
    const productPrices = catalog.filter(
      (price) => price.productId === product.id,
    );
    const availableUnits = [
      ...new Set(productPrices.map((price) => price.priceUnit.code)),
    ];

    if (availableUnits.length === 0) {
      return {
        original,
        status: 'product_not_found',
        interpretation: { product: product.name, quantity, unit: attemptedUnit },
        availableUnits: [],
        message: `${product.name} does not have any prices available yet.`,
      };
    }

    return {
      original,
      status: 'unsupported_unit',
      interpretation: { product: product.name, quantity, unit: attemptedUnit },
      availableUnits,
      // Every real offering across all of this product's units, so the
      // frontend can let the customer pick one directly and send its
      // buyPriceId straight to POST /orders/quote/resolve-item - no
      // separate "pick a unit, then pick an offering" round trip needed.
      choices: productPrices.map((price) => this.toChoice(price)),
      message: `${product.name} is not currently available in ${this.displayUnit(attemptedUnit)}. Available units are ${this.joinWords(availableUnits)}.`,
    };
  }

  private clean(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9/\s-]/g, ' ')
      .replace(/-/g, ' ')
      .replace(
        /\b(bags|baskets|buckets|crates|bottles|bunches|pieces|litres|liters|kilograms)\b/g,
        (word) =>
          ({
            bags: 'bag',
            baskets: 'basket',
            buckets: 'bucket',
            crates: 'crate',
            bottles: 'bottle',
            bunches: 'bunch',
            pieces: 'piece',
            litres: 'litre',
            liters: 'liter',
            kilograms: 'kilogram',
          })[word] ?? word,
      )
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

  private formatMoney(value: number, currency = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(value);
  }
}
