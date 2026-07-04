import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PriceQualityGrade, PriceSource, PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

type ProductSeed = {
  name: string;
  category: string;
};

type ProductPricing = {
  unit: string;
  baseAmount: number;
};

const catalog: Array<{
  category: string;
  products: string[];
}> = [
  {
    category: 'Grains',
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
    category: 'Tubers',
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
    category: 'Grains',
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
    category: 'Legumes',
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
    category: 'Vegetables',
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
    category: 'Fruits',
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
    category: 'Oils',
    products: [
      'Palm Oil',
      'Groundnut Oil',
      'Vegetable Oil',
      'Coconut Oil',
      'Shea Butter',
    ],
  },
  {
    category: 'Meat',
    products: ['Beef', 'Goat Meat', 'Chicken', 'Turkey'],
  },
  {
    category: 'Seafood',
    products: ['Fish', 'Catfish', 'Tilapia', 'Stockfish', 'Crayfish', 'Snail'],
  },
  {
    category: 'Dairy',
    products: ['Eggs'],
  },
  {
    category: 'Spices',
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
    category: 'Snacks',
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
    category: 'Seafood',
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
    category: 'Dairy',
    products: ['Milk', 'Yogurt', 'Butter', 'Cheese'],
  },
  {
    category: 'Beverages',
    products: ['Cocoa Powder', 'Tea', 'Coffee'],
  },
  {
    category: 'Legumes',
    products: ['Beans', 'Groundnut'],
  },
  {
    category: 'Meat',
    products: ['Meat'],
  },
  {
    category: 'Dairy',
    products: ['Egg'],
  },
  {
    category: 'Spices',
    products: ['Spices'],
  },
  {
    category: 'Fruits',
    products: ['Fruits'],
  },
  {
    category: 'Vegetables',
    products: ['Vegetables'],
  },
  {
    category: 'Grains',
    products: ['Flour'],
  },
  {
    category: 'Other',
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
    return { unit: 'litre', baseAmount: 2500 };
  }

  if (['eggs', 'egg'].includes(name)) {
    return { unit: 'crate', baseAmount: 6500 };
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
    return { unit: 'bunch', baseAmount: 4000 };
  }

  if (
    product.category === 'Grains' ||
    product.category === 'Legumes' ||
    product.category === 'Tubers'
  ) {
    return { unit: 'bag', baseAmount: 55000 };
  }

  if (product.category === 'Vegetables' || product.category === 'Fruits') {
    return { unit: 'big_basket', baseAmount: 22000 };
  }

  if (product.category === 'Meat' || product.category === 'Seafood') {
    return { unit: 'kg', baseAmount: 7500 };
  }

  if (product.category === 'Spices') {
    return { unit: 'kg', baseAmount: 5000 };
  }

  if (
    product.category === 'Dairy' ||
    product.category === 'Beverages' ||
    product.category === 'Snacks'
  ) {
    return { unit: 'piece', baseAmount: 3000 };
  }

  return { unit: 'piece', baseAmount: 4500 };
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

      const priceUnits = await tx.priceUnit.findMany();
      const priceUnitIdByCode = new Map(
        priceUnits.map((priceUnit) => [priceUnit.code, priceUnit.id]),
      );

      const deleted = await tx.product.deleteMany();
      const categoryNames = [
        ...new Set(products.map((product) => product.category)),
      ];
      for (const [index, name] of categoryNames.entries()) {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        await tx.productCategory.upsert({
          where: { slug },
          update: { name, isActive: true, sortOrder: (index + 1) * 10 },
          create: { name, slug, sortOrder: (index + 1) * 10 },
        });
      }
      const categories = await tx.productCategory.findMany({
        where: { name: { in: categoryNames } },
      });
      const categoryIdByName = new Map(
        categories.map((category) => [category.name, category.id]),
      );
      const inserted = await tx.product.createMany({
        data: products.map((product) => ({
          name: product.name,
          sku: createSku(product),
          categoryId: categoryIdByName.get(product.category) as string,
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
        const priceUnitId = priceUnitIdByCode.get(unit);

        if (!priceUnitId) {
          throw new Error(`Missing price unit seed data for code "${unit}".`);
        }

        return markets.map((market, marketIndex) => ({
          productId: createdProduct.id,
          marketId: market.id,
          amount: calculateMarketAmount(product, marketIndex),
          currency: 'NGN',
          priceUnitId,
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
