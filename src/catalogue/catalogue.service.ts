import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PriceUnitsService } from '../price-units/price-units.service';
import {
  CreateBrandDto,
  CreateManufacturerDto,
  CreateProductOfferingDto,
  CreateProductPackageDto,
  CreateProductVariantDto,
  UpdateBrandDto,
  UpdateManufacturerDto,
  UpdateProductOfferingDto,
  UpdateProductPackageDto,
  UpdateProductVariantDto,
} from './dto/catalogue.dto';

type OfferingFilters = {
  productId?: string;
  variantId?: string;
  brandId?: string;
  packageId?: string;
};

const OFFERING_INCLUDE = {
  product: true,
  variant: true,
  brand: { include: { manufacturer: true } },
  package: { include: { baseUnit: true } },
} satisfies Prisma.ProductOfferingInclude;

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceUnitsService: PriceUnitsService,
  ) {}

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    await this.requireProduct(productId);
    const variant = await this.runWrite(() =>
      this.prisma.productVariant.create({
        data: {
          productId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          isActive: dto.isActive,
        },
      }),
    );
    return { message: 'Product variant created successfully.', variant };
  }

  async findVariants(productId: string) {
    await this.requireProduct(productId);
    const variants = await this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { name: 'asc' },
    });
    return { data: variants };
  }

  async updateVariant(id: string, dto: UpdateProductVariantDto) {
    const variant = await this.updateOrNotFound(
      () =>
        this.prisma.productVariant.update({
          where: { id },
          data: {
            name: dto.name?.trim(),
            code: dto.code?.trim().toUpperCase(),
            isActive: dto.isActive,
          },
        }),
      'Product variant',
    );
    return { message: 'Product variant updated successfully.', variant };
  }

  async deactivateVariant(id: string) {
    await this.updateOrNotFound(
      () =>
        this.prisma.productVariant.update({
          where: { id },
          data: { isActive: false },
        }),
      'Product variant',
    );
    return { message: 'Product variant deactivated successfully.' };
  }

  async createManufacturer(dto: CreateManufacturerDto) {
    const manufacturer = await this.runWrite(() =>
      this.prisma.manufacturer.create({
        data: { name: dto.name.trim(), isActive: dto.isActive },
      }),
    );
    return { message: 'Manufacturer created successfully.', manufacturer };
  }

  async findManufacturers() {
    const manufacturers = await this.prisma.manufacturer.findMany({
      include: { brands: true },
      orderBy: { name: 'asc' },
    });
    return { data: manufacturers };
  }

  async updateManufacturer(id: string, dto: UpdateManufacturerDto) {
    const manufacturer = await this.updateOrNotFound(
      () =>
        this.prisma.manufacturer.update({
          where: { id },
          data: { name: dto.name?.trim(), isActive: dto.isActive },
        }),
      'Manufacturer',
    );
    return { message: 'Manufacturer updated successfully.', manufacturer };
  }

  async deactivateManufacturer(id: string) {
    await this.updateOrNotFound(
      () =>
        this.prisma.manufacturer.update({
          where: { id },
          data: { isActive: false },
        }),
      'Manufacturer',
    );
    return { message: 'Manufacturer deactivated successfully.' };
  }

  async createBrand(dto: CreateBrandDto) {
    if (dto.manufacturerId) {
      await this.requireManufacturer(dto.manufacturerId);
    }
    const brand = await this.runWrite(() =>
      this.prisma.brand.create({
        data: {
          manufacturerId: dto.manufacturerId,
          name: dto.name.trim(),
          isActive: dto.isActive,
        },
        include: { manufacturer: true },
      }),
    );
    return { message: 'Brand created successfully.', brand };
  }

  async findBrands() {
    const brands = await this.prisma.brand.findMany({
      include: { manufacturer: true },
      orderBy: { name: 'asc' },
    });
    return { data: brands };
  }

  async updateBrand(id: string, dto: UpdateBrandDto) {
    if (dto.manufacturerId) {
      await this.requireManufacturer(dto.manufacturerId);
    }
    const brand = await this.updateOrNotFound(
      () =>
        this.prisma.brand.update({
          where: { id },
          data: {
            manufacturerId: dto.manufacturerId,
            name: dto.name?.trim(),
            isActive: dto.isActive,
          },
          include: { manufacturer: true },
        }),
      'Brand',
    );
    return { message: 'Brand updated successfully.', brand };
  }

  async deactivateBrand(id: string) {
    await this.updateOrNotFound(
      () =>
        this.prisma.brand.update({ where: { id }, data: { isActive: false } }),
      'Brand',
    );
    return { message: 'Brand deactivated successfully.' };
  }

  async createPackage(dto: CreateProductPackageDto) {
    this.validatePackageMeasurement(dto.baseUnit, dto.quantity);
    const baseUnit = dto.baseUnit
      ? await this.priceUnitsService.requireByCode(dto.baseUnit)
      : undefined;
    const productPackage = await this.runWrite(() =>
      this.prisma.productPackage.create({
        data: {
          name: dto.name.trim(),
          packageType: dto.packageType,
          baseUnitId: baseUnit?.id,
          quantity: dto.quantity,
          isActive: dto.isActive,
        },
        include: { baseUnit: true },
      }),
    );
    return {
      message: 'Product package created successfully.',
      package: productPackage,
    };
  }

  async findPackages() {
    const packages = await this.prisma.productPackage.findMany({
      include: { baseUnit: true },
      orderBy: { name: 'asc' },
    });
    return { data: packages };
  }

  async updatePackage(id: string, dto: UpdateProductPackageDto) {
    const existing = await this.prisma.productPackage.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Product package not found');
    this.validatePackageMeasurement(
      dto.baseUnit ?? existing.baseUnitId ?? undefined,
      dto.quantity ?? existing.quantity?.toNumber(),
    );
    const baseUnit = dto.baseUnit
      ? await this.priceUnitsService.requireByCode(dto.baseUnit)
      : undefined;
    const productPackage = await this.runWrite(() =>
      this.prisma.productPackage.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          packageType: dto.packageType,
          baseUnitId: baseUnit?.id,
          quantity: dto.quantity,
          isActive: dto.isActive,
        },
        include: { baseUnit: true },
      }),
    );
    return {
      message: 'Product package updated successfully.',
      package: productPackage,
    };
  }

  async deactivatePackage(id: string) {
    await this.updateOrNotFound(
      () =>
        this.prisma.productPackage.update({
          where: { id },
          data: { isActive: false },
        }),
      'Product package',
    );
    return { message: 'Product package deactivated successfully.' };
  }

  async createOffering(dto: CreateProductOfferingDto) {
    await this.validateOfferingReferences(dto);
    await this.ensureOfferingIsUnique(dto);
    const offering = await this.runWrite(() =>
      this.prisma.productOffering.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          brandId: dto.brandId,
          packageId: dto.packageId,
          sku: dto.sku.trim().toUpperCase(),
          isActive: dto.isActive,
        },
        include: OFFERING_INCLUDE,
      }),
    );
    return { message: 'Product offering created successfully.', offering };
  }

  async findOfferings(filters: OfferingFilters = {}) {
    const offerings = await this.prisma.productOffering.findMany({
      where: filters,
      include: OFFERING_INCLUDE,
      orderBy: { sku: 'asc' },
    });
    return { data: offerings };
  }

  async findOffering(id: string) {
    const offering = await this.prisma.productOffering.findUnique({
      where: { id },
      include: OFFERING_INCLUDE,
    });
    if (!offering) throw new NotFoundException('Product offering not found');
    return { offering };
  }

  async updateOffering(id: string, dto: UpdateProductOfferingDto) {
    const existing = await this.prisma.productOffering.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Product offering not found');
    const values = {
      productId: dto.productId ?? existing.productId,
      variantId:
        dto.variantId === undefined
          ? (existing.variantId ?? undefined)
          : (dto.variantId ?? undefined),
      brandId:
        dto.brandId === undefined
          ? (existing.brandId ?? undefined)
          : (dto.brandId ?? undefined),
      packageId: dto.packageId ?? existing.packageId,
    };
    await this.validateOfferingReferences(values);
    await this.ensureOfferingIsUnique(values, id);
    const offering = await this.runWrite(() =>
      this.prisma.productOffering.update({
        where: { id },
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          brandId: dto.brandId,
          packageId: dto.packageId,
          sku: dto.sku?.trim().toUpperCase(),
          isActive: dto.isActive,
        },
        include: OFFERING_INCLUDE,
      }),
    );
    return { message: 'Product offering updated successfully.', offering };
  }

  async deactivateOffering(id: string) {
    await this.updateOrNotFound(
      () =>
        this.prisma.productOffering.update({
          where: { id },
          data: { isActive: false },
        }),
      'Product offering',
    );
    return { message: 'Product offering deactivated successfully.' };
  }

  private async validateOfferingReferences(input: {
    productId: string;
    variantId?: string;
    brandId?: string;
    packageId: string;
  }) {
    const [product, variant, brand, productPackage] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: input.productId } }),
      input.variantId
        ? this.prisma.productVariant.findUnique({
            where: { id: input.variantId },
          })
        : undefined,
      input.brandId
        ? this.prisma.brand.findUnique({ where: { id: input.brandId } })
        : undefined,
      this.prisma.productPackage.findUnique({
        where: { id: input.packageId },
      }),
    ]);
    if (!product) throw new BadRequestException('Product does not exist');
    if (input.variantId && !variant) {
      throw new BadRequestException('Product variant does not exist');
    }
    if (variant && variant.productId !== input.productId) {
      throw new BadRequestException(
        'Product variant does not belong to the selected product',
      );
    }
    if (input.brandId && !brand) {
      throw new BadRequestException('Brand does not exist');
    }
    if (!productPackage) {
      throw new BadRequestException('Product package does not exist');
    }
  }

  private async ensureOfferingIsUnique(
    input: {
      productId: string;
      variantId?: string | null;
      brandId?: string | null;
      packageId: string;
    },
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.productOffering.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        productId: input.productId,
        variantId: input.variantId ?? null,
        brandId: input.brandId ?? null,
        packageId: input.packageId,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new BadRequestException(
        'A product offering with the same product, variant, brand, and package already exists',
      );
    }
  }

  private validatePackageMeasurement(baseUnit?: string, quantity?: number) {
    if (
      (baseUnit && quantity === undefined) ||
      (!baseUnit && quantity !== undefined)
    ) {
      throw new BadRequestException(
        'Package baseUnit and quantity must be provided together',
      );
    }
  }

  private async requireProduct(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async requireManufacturer(id: string) {
    const manufacturer = await this.prisma.manufacturer.findUnique({
      where: { id },
    });
    if (!manufacturer)
      throw new BadRequestException('Manufacturer does not exist');
    return manufacturer;
  }

  private async updateOrNotFound<T>(
    operation: () => Promise<T>,
    entity: string,
  ): Promise<T> {
    try {
      return await this.runWrite(operation);
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException(`${entity} not found`);
      }
      throw error;
    }
  }

  private async runWrite<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new BadRequestException(
          'A catalogue record with the same identity already exists',
        );
      }
      throw error;
    }
  }

  private isUniqueConstraint(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isRecordNotFound(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
