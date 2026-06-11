import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PriceQualityGrade,
  PriceSource,
  PriceUnit,
  PrismaClient,
  ProductCategory,
} from '@prisma/client';
import { Pool } from 'pg';

type ProductSeed = {
  name: string;
  category: ProductCategory;
};

type ProductPricing = {
  unit: PriceUnit;
  baseAmount: number;
};

const catalog: Array<{
  category: ProductCategory;
  products: string[];
}> = [
  {
    category: ProductCategory.Grains,
    products: [
      'Rice',
      'Ofada Rice',
      'Local Rice',
      'Imported Rice',
      'Maize (Corn)',
      'Millet',
      'Sorghum (Guinea Corn)',
      'Wheat',
      'Oats',
      'Barley',
    ],
  },
  {
    category: ProductCategory.Tubers,
    products: [
      'Yam',
      'Cassava',
      'Sweet Potatoes',
      'Irish Potatoes',
      'Cocoyam',
      'Plantain',
      'Banana',
    ],
  },
  {
    category: ProductCategory.Grains,
    products: [
      'Garri',
      'Fufu',
      'Starch',
      'Poundo Yam',
      'Amala Flour',
      'Semovita',
      'Semo',
      'Wheat Flour',
      'Corn Flour',
    ],
  },
  {
    category: ProductCategory.Legumes,
    products: [
      'Brown Beans',
      'White Beans',
      'Black-eyed Peas',
      'Soybeans',
      'Groundnut (Peanut)',
      'Bambara Nut',
      'Cowpeas',
    ],
  },
  {
    category: ProductCategory.Vegetables,
    products: [
      'Tomatoes',
      'Pepper',
      'Tatase',
      'Shombo',
      'Ata Rodo',
      'Onion',
      'Okra',
      'Ugu',
      'Waterleaf',
      'Bitterleaf',
      'Scent Leaf',
      'Spinach',
      'Cabbage',
      'Lettuce',
      'Carrot',
      'Cucumber',
    ],
  },
  {
    category: ProductCategory.Fruits,
    products: [
      'Mango',
      'Pineapple',
      'Watermelon',
      'Orange',
      'Pawpaw',
      'Avocado Pear',
      'Coconut',
      'Cashew Fruit',
      'Guava',
      'Banana',
      'Apple',
      'Grapes',
    ],
  },
  {
    category: ProductCategory.Oils,
    products: [
      'Palm Oil',
      'Groundnut Oil',
      'Vegetable Oil',
      'Coconut Oil',
      'Shea Butter',
    ],
  },
  {
    category: ProductCategory.Meat,
    products: ['Beef', 'Goat Meat', 'Chicken', 'Turkey'],
  },
  {
    category: ProductCategory.Seafood,
    products: ['Fish', 'Catfish', 'Tilapia', 'Stockfish', 'Crayfish', 'Snail'],
  },
  {
    category: ProductCategory.Dairy,
    products: ['Eggs'],
  },
  {
    category: ProductCategory.Spices,
    products: [
      'Egusi',
      'Ogbono',
      'Okazi',
      'Oha Leaf',
      'Uziza',
      'Banga Spice',
      'Ogiri',
      'Iru (Locust Beans)',
      'Curry',
      'Thyme',
      'Ginger',
      'Garlic',
      'Curry Powder',
      'Nutmeg',
      'Cinnamon',
      'Black Pepper',
      'Seasoning Cubes',
      'Salt',
    ],
  },
  {
    category: ProductCategory.Snacks,
    products: [
      'Chin Chin',
      'Kilishi',
      'Kuli Kuli',
      'Puff Puff',
      'Boli',
      'Suya',
      'Akara',
      'Moi Moi',
    ],
  },
  {
    category: ProductCategory.Seafood,
    products: [
      'Dry Fish',
      'Fresh Fish',
      'Prawns',
      'Shrimps',
      'Crab',
      'Lobster',
    ],
  },
  {
    category: ProductCategory.Dairy,
    products: ['Milk', 'Yogurt', 'Butter', 'Cheese'],
  },
  {
    category: ProductCategory.Beverages,
    products: ['Cocoa Powder', 'Tea', 'Coffee'],
  },
  {
    category: ProductCategory.Legumes,
    products: ['Beans', 'Groundnut'],
  },
  {
    category: ProductCategory.Meat,
    products: ['Meat'],
  },
  {
    category: ProductCategory.Dairy,
    products: ['Egg'],
  },
  {
    category: ProductCategory.Spices,
    products: ['Spices'],
  },
  {
    category: ProductCategory.Fruits,
    products: ['Fruits'],
  },
  {
    category: ProductCategory.Vegetables,
    products: ['Vegetables'],
  },
  {
    category: ProductCategory.Grains,
    products: ['Flour'],
  },
  {
    category: ProductCategory.Other,
    products: ['Noodles', 'Sugar'],
  },
];

function buildProducts(): ProductSeed[] {
  const productsByName = new Map<string, ProductSeed>();

  for (const group of catalog) {
    for (const name of group.products) {
      const key = name.trim().toLowerCase();

      if (!productsByName.has(key)) {
        productsByName.set(key, { name, category: group.category });
      }
    }
  }

  return [...productsByName.values()];
}

function createSku(product: ProductSeed): string {
  const slug = product.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();

  return `PROD-${product.category.toUpperCase()}-${slug}`;
}

function getProductPricing(product: ProductSeed): ProductPricing {
  const name = product.name.toLowerCase();

  if (name.includes('oil') || ['milk', 'yogurt'].includes(name)) {
    return { unit: PriceUnit.litre, baseAmount: 2500 };
  }

  if (['eggs', 'egg'].includes(name)) {
    return { unit: PriceUnit.crate, baseAmount: 6500 };
  }

  if (
    [
      'plantain',
      'banana',
      'ugu',
      'waterleaf',
      'bitterleaf',
      'scent leaf',
    ].includes(name)
  ) {
    return { unit: PriceUnit.bunch, baseAmount: 4000 };
  }

  if (
    product.category === ProductCategory.Grains ||
    product.category === ProductCategory.Legumes ||
    product.category === ProductCategory.Tubers
  ) {
    return { unit: PriceUnit.bag, baseAmount: 55000 };
  }

  if (
    product.category === ProductCategory.Vegetables ||
    product.category === ProductCategory.Fruits
  ) {
    return { unit: PriceUnit.basket, baseAmount: 22000 };
  }

  if (
    product.category === ProductCategory.Meat ||
    product.category === ProductCategory.Seafood
  ) {
    return { unit: PriceUnit.kg, baseAmount: 7500 };
  }

  if (product.category === ProductCategory.Spices) {
    return { unit: PriceUnit.kg, baseAmount: 5000 };
  }

  if (
    product.category === ProductCategory.Dairy ||
    product.category === ProductCategory.Beverages ||
    product.category === ProductCategory.Snacks
  ) {
    return { unit: PriceUnit.piece, baseAmount: 3000 };
  }

  return { unit: PriceUnit.piece, baseAmount: 4500 };
}

function stringScore(value: string): number {
  return [...value].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
}

function calculateMarketAmount(
  product: ProductSeed,
  marketIndex: number,
): number {
  const { baseAmount } = getProductPricing(product);
  const productVariation = 0.85 + (stringScore(product.name) % 31) / 100;
  const marketVariation = 0.92 + (marketIndex % 5) * 0.04;

  return (
    Math.round((baseAmount * productVariation * marketVariation) / 50) * 50
  );
}

async function main() {
  if (process.env.CONFIRM_PRODUCT_RESET !== 'YES') {
    throw new Error(
      'Reset cancelled. Run with CONFIRM_PRODUCT_RESET=YES to delete and reseed products.',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: true }),
  });
  const products = buildProducts();
  const observedAt = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const markets = await tx.market.findMany({
        where: { status: 'active' },
        orderBy: { marketname: 'asc' },
      });

      if (markets.length === 0) {
        throw new Error(
          'No active markets found. Create at least one market before resetting products.',
        );
      }

      const deleted = await tx.product.deleteMany();
      const inserted = await tx.product.createMany({
        data: products.map((product) => ({
          ...product,
          sku: createSku(product),
        })),
      });

      const createdProducts = await tx.product.findMany({
        where: {
          sku: { in: products.map((product) => createSku(product)) },
        },
      });
      const seedBySku = new Map(
        products.map((product) => [createSku(product), product]),
      );
      const marketPrices = createdProducts.flatMap((createdProduct) => {
        const product = seedBySku.get(createdProduct.sku);

        if (!product) {
          throw new Error(`Missing seed data for ${createdProduct.sku}.`);
        }

        const { unit } = getProductPricing(product);

        return markets.map((market, marketIndex) => ({
          productId: createdProduct.id,
          marketId: market.id,
          amount: calculateMarketAmount(product, marketIndex),
          currency: 'NGN',
          unit,
          quantity: 1,
          qualityGrade:
            marketIndex % 3 === 0
              ? PriceQualityGrade.premium
              : marketIndex % 3 === 1
                ? PriceQualityGrade.standard
                : PriceQualityGrade.low,
          source: PriceSource.admin,
          observedAt,
          notes: `Seed price for ${product.name} at ${market.marketname}.`,
        }));
      });
      const insertedMarketPrices = await tx.marketPrice.createMany({
        data: marketPrices,
      });

      return {
        deleted: deleted.count,
        inserted: inserted.count,
        marketPrices: insertedMarketPrices.count,
        markets: markets.length,
      };
    });

    console.log(
      `Product reset complete: deleted ${result.deleted}, inserted ${result.inserted} products and ${result.marketPrices} prices across ${result.markets} markets.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
