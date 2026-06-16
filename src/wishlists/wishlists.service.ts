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
import { ConvertWishlistDto } from './dto/convert-wishlist.dto';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { QuoteWishlistDto } from './dto/quote-wishlist.dto';
import { UpdateWishlistItemDto } from './dto/update-wishlist-item.dto';
import { WishlistItemDto } from './dto/wishlist-item.dto';

type WishlistWithItems = Prisma.WishlistGetPayload<{
  include: {
    items: { include: { product: true } };
    order: { select: { id: true; status: true; paymentStatus: true } };
  };
}>;

type ActiveBuyPrice = BuyPrice & { product: Product };

type ResolvedWishlistItem = {
  wishlistItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: PriceUnit;
  status: 'matched' | 'unavailable';
  availableUnits: PriceUnit[];
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
  ) {}

  async create(userId: string, dto: CreateWishlistDto) {
    this.ensureUniqueItems(dto.items ?? []);
    await this.ensureProductsExist(
      (dto.items ?? []).map((item) => item.productId),
    );

    const wishlist = await this.prisma.wishlist.create({
      data: {
        userId,
        name: dto.name?.trim() || 'My Wishlist',
        items: dto.items?.length
          ? {
              create: dto.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unit: item.unit,
              })),
            }
          : undefined,
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
    await this.ensureProductsExist([dto.productId]);

    try {
      await this.prisma.wishlistItem.create({
        data: {
          wishlistId: wishlist.id,
          productId: dto.productId,
          quantity: dto.quantity,
          unit: dto.unit,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'This product and unit already exist in the wishlist',
        );
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
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    try {
      await this.prisma.wishlistItem.update({
        where: { id: item.id },
        data: {
          quantity: dto.quantity,
          unit: dto.unit,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          'This product and unit already exist in the wishlist',
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
          'The wishlist cannot be converted until every item has an active price for its selected unit.',
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
      include: { product: true },
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
      ...new Set(productPrices.map((price) => price.unit)),
    ];
    const price = productPrices.find(
      (candidate) => candidate.unit === item.unit,
    );
    const quantity = this.toNumber(item.quantity);

    if (!price) {
      return {
        wishlistItemId: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity,
        unit: item.unit,
        status: 'unavailable',
        availableUnits,
        message: availableUnits.length
          ? `${item.product.name} is not available in ${this.displayUnit(item.unit)}. Available units are ${this.joinUnits(availableUnits)}.`
          : `${item.product.name} does not currently have an active price.`,
      };
    }

    const unitPrice = this.toNumber(price.finalPrice);

    return {
      wishlistItemId: item.id,
      productId: item.productId,
      productName: item.product.name,
      quantity,
      unit: item.unit,
      status: 'matched',
      availableUnits,
      buyPriceId: price.id,
      unitPrice,
      totalPrice: this.roundMoney(unitPrice * quantity),
      message: `${item.product.name} matched at the current ${this.displayUnit(item.unit)} price.`,
    };
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

  private ensureUniqueItems(items: WishlistItemDto[]) {
    const keys = items.map((item) => `${item.productId}:${item.unit}`);

    if (new Set(keys).size !== keys.length) {
      throw new BadRequestException(
        'A wishlist cannot contain duplicate product and unit entries',
      );
    }
  }

  private wishlistInclude() {
    return {
      items: {
        include: { product: true },
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

  private displayUnit(unit: PriceUnit): string {
    return unit.replace(/_/g, ' ');
  }

  private joinUnits(units: PriceUnit[]): string {
    const displayed = units.map((unit) => this.displayUnit(unit));
    return displayed.length === 1
      ? displayed[0]
      : `${displayed.slice(0, -1).join(', ')} and ${displayed.at(-1)}`;
  }
}
