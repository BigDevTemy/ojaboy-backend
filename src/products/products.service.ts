import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductFilters = {
  search?: string;
  category?: ProductCategory;
};

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
    const products = await this.prisma.product.findMany({
      where: this.toWhereInput(filters),
      include: { marketPrices: true, buyPrices: true },
      orderBy: { name: 'asc' },
    });

    return { data: products };
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
    return {
      category: filters.category,
      OR: filters.search
        ? [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
