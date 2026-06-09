import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductFilters = {
  search?: string;
  category?: ProductCategory;
  limit?: string;
  offset?: string;
};

const DEFAULT_PRODUCT_LIMIT = 20;
const MAX_PRODUCT_LIMIT = 50;

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

  async findAll(filters: ProductFilters = {}) {
    const pagination = this.toPagination(filters);
    const queryArgs = {
      where: this.toWhereInput(filters),
      include: this.toProductListInclude(),
      orderBy: { name: 'asc' },
      take: pagination.limit,
      skip: pagination.offset,
    } satisfies Prisma.ProductFindManyArgs;

    const products = await this.findManyWithConnectionRetry(queryArgs);

    return { data: products, meta: pagination };
  }

  async findByCategory(category: ProductCategory) {
    return this.findAll({ category });
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { marketPrices: true, buyPrices: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return { product };
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

  async updateStatus(id: string, updateProductStatusDto: UpdateProductStatusDto) {
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

  private toUpdateData(dto: UpdateProductDto): Prisma.ProductUncheckedUpdateInput {
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

  private toProductListInclude(): Prisma.ProductInclude {
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
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          market: {
            select: { id: true, marketname: true, marketaddress: true },
          },
        },
      },
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

  private async findManyWithConnectionRetry(args: Prisma.ProductFindManyArgs) {
    try {
      return await this.prisma.product.findMany(args);
    } catch (error) {
      if (!this.isTransientConnectionError(error)) {
        throw error;
      }

      await this.delay(100);

      return this.prisma.product.findMany(args);
    }
  }

  private delay(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
