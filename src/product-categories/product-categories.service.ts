import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductCategoryDto,
  UpdateProductCategoryDto,
} from './dto/product-category.dto';

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductCategoryDto) {
    try {
      const category = await this.prisma.productCategory.create({
        data: {
          name: dto.name.trim(),
          slug: this.slug(dto.slug ?? dto.name),
          description: dto.description?.trim(),
          imageUrl: dto.imageUrl?.trim(),
          sortOrder: dto.sortOrder,
        },
      });
      return { message: 'Product category created successfully.', category };
    } catch (error) {
      this.throwKnownWriteError(error);
    }
  }

  async findAll(isActive?: boolean) {
    const categories = await this.prisma.productCategory.findMany({
      where: isActive === undefined ? undefined : { isActive },
      include: { _count: { select: { products: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { data: categories };
  }

  async findOne(id: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Product category not found');
    return { category };
  }

  async update(id: string, dto: UpdateProductCategoryDto) {
    const existing = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Product category not found');

    try {
      const category = await this.prisma.productCategory.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          slug:
            dto.slug !== undefined
              ? this.slug(dto.slug)
              : dto.name
                ? this.slug(dto.name)
                : undefined,
          description: dto.description?.trim(),
          imageUrl: dto.imageUrl?.trim(),
          isActive: dto.isActive,
          sortOrder: dto.sortOrder,
        },
      });
      return { message: 'Product category updated successfully.', category };
    } catch (error) {
      this.throwKnownWriteError(error);
    }
  }

  async deactivate(id: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException('Product category not found');
    await this.prisma.productCategory.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Product category deactivated successfully.' };
  }

  private slug(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Category slug is invalid');
    return slug;
  }

  private throwKnownWriteError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A product category with this name or slug already exists',
      );
    }
    throw error;
  }
}
