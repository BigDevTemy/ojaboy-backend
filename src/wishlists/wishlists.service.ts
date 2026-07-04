import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  BuyPrice,
  PriceUnit,
  Prisma,
  Product,
  ProductStatus,
} from '@prisma/client';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import { ConvertWishlistDto } from './dto/convert-wishlist.dto';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { QuoteWishlistDto } from './dto/quote-wishlist.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { WishlistItemDto } from './dto/wishlist-item.dto';

type WishlistWithItems = Prisma.WishlistGetPayload<{
  include: {
    items: {
      include: {
        product: true;
        productOffering: {
          include: {
            variant: true;
            brand: true;
            package: true;
          };
        };
        priceUnit: true;
      };
    };
    order: { select: { id: true; status: true; paymentStatus: true } };
  };
}>;

type ActiveBuyPrice = BuyPrice & {
  product: Product;
  productOffering: {
    id: string;
    sku: string;
    variant: { id: string; name: string } | null;
    brand: { id: string; name: string } | null;
    package: { id: string; name: string };
  } | null;
  priceUnit: PriceUnit;
};

type WishlistOfferingChoice = {
  buyPriceId: string;
  productOfferingId: string;
  label: string;
  unitPrice: number;
};

type ResolvedWishlistItem = {
  wishlistItemId: string;
  productId: string;
  productOfferingId?: string;
  productName: string;
  variantName?: string;
  brandName?: string;
  packageName?: string;
  offeringSku?: string;
  quantity: number;
  unit: string;
  status: 'matched' | 'needs_confirmation' | 'unavailable';
  availableUnits: string[];
  choices?: WishlistOfferingChoice[];
  buyPriceId?: string;
  unitPrice?: number;
  totalPrice?: number;
  message: string;
};

@Injectable()
export class WishlistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async create(userId: string, dto: CreateWishlistDto) {
    this.ensureUniqueItems(dto.items ?? []);
    await this.validateItemReferences(dto.items ?? []);
    const items = dto.items?.length
      ? await Promise.all(
          dto.items.map(async (item) => ({
            productId: item.productId,
            productOfferingId: item.productOfferingId,
            quantity: item.quantity,
            priceUnitId: (
              await this.priceUnitsService.requireByCode(item.unit)
            ).id,
          })),
        )
      : undefined;

    const wishlist = await this.prisma.wishlist.create({
      data: {
        userId,
        name: dto.name?.trim() || 'My Wishlist',
        items: items?.length ? { create: items } : undefined,
      },
      include: this.wishlistInclude(),
    });

    return {
      message: 'Wishlist created successfully.',
      wishlist,
    };
  }

  async findAll(userId: string) {
    const wishlists = await this.prisma.wishlist.findMany({
      where: { userId },
      include: this.wishlistInclude(),
      orderBy: { updatedAt: 'desc' },
    });

    return { data: wishlists };
  }

  async findOne(userId: string, id: string) {
    const wishlist = await this.getOwnedWishlist(userId, id);
    return { wishlist };
  }

  async addItem(userId: string, wishlistId: string, dto: WishlistItemDto) {
    const wishlist = await this.getEditableWishlist(userId, wishlistId);
    await this.validateItemReferences([dto]);
    await this.ensureItemDoesNotExist(wishlist.id, dto);
    const priceUnit = await this.priceUnitsService.requireByCode(dto.unit);

    try {
      await this.prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId: dto.productId,
          productOfferingId: dto.productOfferingId,
          quantity: dto.quantity,
          priceUnitId: priceUnit.id,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(this.duplicateItemMessage(dto));
      }
      throw error;
    }

    return {
      message: 'Wishlist item added successfully.',
      wishlist: await this.getOwnedWishlist(userId, wishlistId),
    };
  }

  async updateItem(
    userId: string,
    wishlistId: string,
    itemId: string,
    dto: UpdateWishlistItemDto,
  ) {
    await this.getEditableWishlist(userId, wishlistId);
    const item = await this.prisma.wishlistItem.findFirst({
      where: { id: itemId, wishlistId },
      include: { priceUnit: true },
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    const productOfferingId =
      dto.productOfferingId === undefined
        ? (item.productOfferingId ?? undefined)
        : (dto.productOfferingId ?? undefined);
    const unit = dto.unit ?? item.priceUnit.code;
    await this.validateItemReferences([
      {
        productId: item.productId,
        productOfferingId,
        quantity: dto.quantity ?? this.toNumber(item.quantity),
        unit,
      },
    ]);
    await this.ensureItemDoesNotExist(
      wishlistId,
      {
        productId: item.productId,
        productOfferingId,
        quantity: dto.quantity ?? this.toNumber(item.quantity),
        unit,
      },
      item.id,
    );
    const priceUnit = dto.unit
      ? await this.priceUnitsService.requireByCode(dto.unit)
      : undefined;

    try {
      await this.prisma.wishlistItem.update({
        where: { id: item.id },
        data: {
          quantity: dto.quantity,
          priceUnitId: priceUnit?.id,
          productOfferingId: dto.productOfferingId,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          this.duplicateItemMessage({
            productId: item.productId,
            productOfferingId,
            quantity: dto.quantity ?? this.toNumber(item.quantity),
            unit,
          }),
        );
      }
      throw error;
    }

    return {
      message: 'Wishlist item updated successfully.',
      wishlist: await this.getOwnedWishlist(userId, wishlistId),
    };
  }

  async removeItem(userId: string, wishlistId: string, itemId: string) {
    await this.getEditableWishlist(userId, wishlistId);
    const deleted = await this.prisma.wishlistItem.deleteMany({
      where: { id: itemId, wishlistId },
    });

    if (deleted.count !== 1) {
      throw new NotFoundException('Wishlist item not found');
    }

    return {
      message: 'Wishlist item removed successfully.',
      wishlist: await this.getOwnedWishlist(userId, wishlistId),
    };
  }

  async quote(user: AuthUser, wishlistId: string, dto: QuoteWishlistDto) {
    const wishlist = await this.getOwnedWishlist(user.id, wishlistId);
    const resolution = await this.resolveItems(wishlist);

    if (!resolution.canProceed) {
      return {
        message: `${resolution.summary.requiresAttention} wishlist item${resolution.summary.requiresAttention === 1 ? '' : 's'} require attention before checkout.`,
        wishlist: this.wishlistSummary(wishlist),
        ...resolution,
      };
    }

    const orderQuote = await this.ordersService.quote(
      {
        items: resolution.orderItems,
        couponCode: dto.couponCode,
        deliveryAddress: dto.deliveryAddress,
      },
      user,
    );

    return {
      message: 'Wishlist quote calculated successfully.',
      wishlist: this.wishlistSummary(wishlist),
      ...resolution,
      orderQuote,
    };
  }

  async convert(user: AuthUser, wishlistId: string, dto: ConvertWishlistDto) {
    const wishlist = await this.getEditableWishlist(user.id, wishlistId);
    const resolution = await this.resolveItems(wishlist);

    if (!resolution.canProceed) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: 'WISHLIST_ITEMS_UNAVAILABLE',
        message:
          'The wishlist cannot be converted until every item has an exact active offering price.',
        items: resolution.items,
        summary: resolution.summary,
      });
    }

    const orderResult = await this.ordersService.create(
      {
        items: resolution.orderItems,
        couponCode: dto.couponCode,
        deliveryAddress: dto.deliveryAddress,
        note: dto.note,
      },
      user,
      { wishlistId: wishlist.id },
    );

    return {
      message: 'Wishlist converted to an order successfully.',
      wishlist: await this.getOwnedWishlist(user.id, wishlist.id),
      order: orderResult.order,
      payment: orderResult.payment,
    };
  }

  async remove(userId: string, id: string) {
    const wishlist = await this.getEditableWishlist(userId, id);
    await this.prisma.wishlist.delete({ where: { id: wishlist.id } });

    return {
      message: 'Wishlist deleted successfully.',
      deletedWishlistId: wishlist.id,
    };
  }

  private async resolveItems(wishlist: WishlistWithItems) {
    if (wishlist.items.length === 0) {
      throw new BadRequestException('The wishlist does not contain any items');
    }

    const now = new Date();
    const prices = await this.prisma.buyPrice.findMany({
      where: {
        productId: { in: wishlist.items.map((item) => item.productId) },
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
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
    const items = wishlist.items.map((item) => this.resolveItem(item, prices));
    const matched = items.filter((item) => item.status === 'matched');

    return {
      canProceed: matched.length === items.length,
      items,
      orderItems: matched.map((item) => ({
        buyPriceId: item.buyPriceId as string,
        quantity: item.quantity,
      })),
      summary: {
        received: items.length,
        matched: matched.length,
        requiresAttention: items.length - matched.length,
      },
    };
  }

  private resolveItem(
    item: WishlistWithItems['items'][number],
    prices: ActiveBuyPrice[],
  ): ResolvedWishlistItem {
    const productPrices = prices.filter(
      (price) => price.productId === item.productId,
    );
    const availableUnits = [
      ...new Set(productPrices.map((price) => price.priceUnit.code)),
    ];
    const matchingUnitPrices = productPrices.filter(
      (candidate) => candidate.priceUnitId === item.priceUnitId,
    );
    const quantity = this.toNumber(item.quantity);

    if (item.productOfferingId) {
      const price = matchingUnitPrices.find(
        (candidate) => candidate.productOfferingId === item.productOfferingId,
      );

      if (!price) {
        return this.unavailableItem(
          item,
          quantity,
          availableUnits,
          `${this.itemLabel(item)} does not currently have an active price.`,
        );
      }

      return this.matchedItem(item, price, quantity, availableUnits);
    }

    if (matchingUnitPrices.length === 0) {
      return {
        wishlistItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity,
        unit: item.priceUnit.code,
        status: 'unavailable',
        availableUnits,
        message: availableUnits.length
          ? `${item.product.name} is not available in ${this.displayUnit(item.priceUnit.code)}. Available units are ${this.joinUnits(availableUnits)}.`
          : `${item.product.name} does not currently have an active price.`,
      };
    }

    const detailedPrices = matchingUnitPrices.filter(
      (price) => price.productOfferingId,
    );
    const legacyPrice = matchingUnitPrices.find(
      (price) => !price.productOfferingId,
    );

    if (detailedPrices.length > 1 || (detailedPrices.length && legacyPrice)) {
      return {
        wishlistItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity,
        unit: item.priceUnit.code,
        status: 'needs_confirmation',
        availableUnits,
        choices: detailedPrices.map((price) => ({
          buyPriceId: price.id,
          productOfferingId: price.productOfferingId as string,
          label: this.priceLabel(price),
          unitPrice: this.toNumber(price.finalPrice),
        })),
        message: `${item.product.name} has multiple ${this.displayUnit(item.priceUnit.code)} offerings. Select an exact offering before checkout.`,
      };
    }

    const price = detailedPrices[0] ?? legacyPrice;
    if (!price) {
      return this.unavailableItem(
        item,
        quantity,
        availableUnits,
        `${item.product.name} does not currently have an active price.`,
      );
    }

    return this.matchedItem(item, price, quantity, availableUnits);
  }

  private async getOwnedWishlist(
    userId: string,
    id: string,
  ): Promise<WishlistWithItems> {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id, userId },
      include: this.wishlistInclude(),
    });

    if (!wishlist) {
      throw new NotFoundException('Wishlist not found');
    }

    return wishlist;
  }

  private async getEditableWishlist(userId: string, id: string) {
    const wishlist = await this.getOwnedWishlist(userId, id);

    if (wishlist.convertedAt || wishlist.orderId) {
      throw new ConflictException(
        'A converted wishlist can no longer be modified',
      );
    }

    return wishlist;
  }

  private async ensureProductsExist(productIds: string[]) {
    const uniqueIds = [...new Set(productIds)];
    if (uniqueIds.length === 0) return;

    const count = await this.prisma.product.count({
      where: { id: { in: uniqueIds } },
    });

    if (count !== uniqueIds.length) {
      throw new NotFoundException(
        'One or more wishlist products were not found',
      );
    }
  }

  private async validateItemReferences(items: WishlistItemDto[]) {
    await this.ensureProductsExist(items.map((item) => item.productId));
    const offeringIds = [
      ...new Set(
        items
          .map((item) => item.productOfferingId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (offeringIds.length === 0) return;

    const offerings = await this.prisma.productOffering.findMany({
      where: { id: { in: offeringIds } },
      select: { id: true, productId: true },
    });
    const offeringById = new Map(
      offerings.map((offering) => [offering.id, offering]),
    );

    for (const item of items) {
      if (!item.productOfferingId) continue;
      const offering = offeringById.get(item.productOfferingId);
      if (!offering) {
        throw new NotFoundException('Product offering was not found');
      }
      if (offering.productId !== item.productId) {
        throw new BadRequestException(
          'Product offering does not belong to the selected product',
        );
      }
    }
  }

  private async ensureItemDoesNotExist(
    wishlistId: string,
    item: WishlistItemDto,
    excludeId?: string,
  ) {
    const priceUnit = item.productOfferingId
      ? undefined
      : await this.priceUnitsService.requireByCode(item.unit);
    const duplicate = await this.prisma.wishlistItem.findFirst({
      where: {
        wishlistId,
        id: excludeId ? { not: excludeId } : undefined,
        ...(item.productOfferingId
          ? { productOfferingId: item.productOfferingId }
          : {
              productId: item.productId,
              productOfferingId: null,
              priceUnitId: priceUnit?.id,
            }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException(this.duplicateItemMessage(item));
    }
  }

  private ensureUniqueItems(items: WishlistItemDto[]) {
    const keys = items.map((item) =>
      item.productOfferingId
        ? `offering:${item.productOfferingId}`
        : `legacy:${item.productId}:${item.unit}`,
    );

    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException(
        'A wishlist cannot contain duplicate product offerings',
      );
    }
  }

  private duplicateItemMessage(item: WishlistItemDto) {
    return item.productOfferingId
      ? 'This product offering already exists in the wishlist'
      : 'This product and unit already exist in the wishlist';
  }

  private wishlistInclude() {
    return {
      items: {
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
        orderBy: { createdAt: 'asc' },
      },
      order: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
        },
      },
    } satisfies Prisma.WishlistInclude;
  }

  private wishlistSummary(wishlist: WishlistWithItems) {
    return {
      id: wishlist.id,
      name: wishlist.name,
      convertedAt: wishlist.convertedAt,
      orderId: wishlist.orderId,
    };
  }

  private matchedItem(
    item: WishlistWithItems['items'][number],
    price: ActiveBuyPrice,
    quantity: number,
    availableUnits: string[],
  ): ResolvedWishlistItem {
    const unitPrice = this.toNumber(price.finalPrice);

    return {
      wishlistItemId: item.id,
      productId: item.productId,
      productOfferingId: price.productOfferingId ?? undefined,
      productName: item.product.name,
      variantName: price.productOffering?.variant?.name,
      brandName: price.productOffering?.brand?.name,
      packageName: price.productOffering?.package.name,
      offeringSku: price.productOffering?.sku,
      quantity,
      unit: item.priceUnit.code,
      status: 'matched',
      availableUnits,
      buyPriceId: price.id,
      unitPrice,
      totalPrice: this.roundMoney(unitPrice * quantity),
      message: `${this.priceLabel(price)} matched at the current ${this.displayUnit(item.priceUnit.code)} price.`,
    };
  }

  private unavailableItem(
    item: WishlistWithItems['items'][number],
    quantity: number,
    availableUnits: string[],
    message: string,
  ): ResolvedWishlistItem {
    return {
      wishlistItemId: item.id,
      productId: item.productId,
      productOfferingId: item.productOfferingId ?? undefined,
      productName: item.product.name,
      variantName: item.productOffering?.variant?.name,
      brandName: item.productOffering?.brand?.name,
      packageName: item.productOffering?.package.name,
      offeringSku: item.productOffering?.sku,
      quantity,
      unit: item.priceUnit.code,
      status: 'unavailable',
      availableUnits,
      message,
    };
  }

  private itemLabel(item: WishlistWithItems['items'][number]) {
    if (!item.productOffering) return item.product.name;
    return [
      item.productOffering.brand?.name,
      item.productOffering.variant?.name,
      item.product.name,
      item.productOffering.package.name,
    ]
      .filter(Boolean)
      .join(' — ');
  }

  private priceLabel(price: ActiveBuyPrice) {
    if (!price.productOffering) return price.product.name;
    return [
      price.productOffering.brand?.name,
      price.productOffering.variant?.name,
      price.product.name,
      price.productOffering.package.name,
    ]
      .filter(Boolean)
      .join(' — ');
  }

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return typeof value === 'number' ? value : value.toNumber();
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private displayUnit(unit: string): string {
    return unit.replace(/_/g, ' ');
  }

  private joinUnits(units: string[]): string {
    const displayed = units.map((unit) => this.displayUnit(unit));
    return displayed.length === 1
      ? displayed[0]
      : `${displayed.slice(0, -1).join(', ')} and ${displayed.at(-1)}`;
  }
}
