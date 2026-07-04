import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PriceUnit, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceUnitDto } from './dto/create-price-unit.dto';
import { UpdatePriceUnitDto } from './dto/update-price-unit.dto';
import { normalizeUnitKey, PriceUnitLookup } from './price-unit-lookup';

@Injectable()
export class PriceUnitsService implements OnModuleInit {
  private lookup: PriceUnitLookup | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Warm the cache on boot so synchronous validators/lookups are ready.
    await this.refresh().catch(() => {
      // The table may not exist yet during the very first migration; lazy-load later.
    });
  }

  async refresh(): Promise<PriceUnitLookup> {
    const units = await this.prisma.priceUnit.findMany({
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    this.lookup = new PriceUnitLookup(units);
    return this.lookup;
  }

  /** Return the cached lookup, loading it on first use. */
  async getLookup(): Promise<PriceUnitLookup> {
    return this.lookup ?? (await this.refresh());
  }

  async isValidCode(code: string): Promise<boolean> {
    if (!code) return false;
    const lookup = await this.getLookup();
    return lookup.isValidCode(code);
  }

  async requireByCode(code: string): Promise<PriceUnit> {
    const lookup = await this.getLookup();
    const unit = lookup.getByCode(code);
    if (!unit || !unit.isActive) {
      throw new BadRequestException(
        `Unknown or inactive price unit "${code}". Valid units: ${lookup
          .activeCodes()
          .join(', ')}`,
      );
    }
    return unit;
  }

  async requireById(id: string): Promise<PriceUnit> {
    const lookup = await this.getLookup();
    const unit = lookup.getById(id);
    if (!unit) {
      throw new NotFoundException('Price unit not found');
    }
    return unit;
  }

  // ---------------------------------------------------------------------------
  // Public / admin API
  // ---------------------------------------------------------------------------

  async findAll(includeInactive = true) {
    const lookup = await this.getLookup();
    const units = lookup
      .all()
      .filter((unit) => includeInactive || unit.isActive);
    return { data: units };
  }

  async findOne(idOrCode: string) {
    const lookup = await this.getLookup();
    const unit = lookup.getById(idOrCode) ?? lookup.getByCode(idOrCode);
    if (!unit) {
      throw new NotFoundException('Price unit not found');
    }
    return { priceUnit: unit };
  }

  async create(dto: CreatePriceUnitDto) {
    const code = normalizeUnitKey(dto.code);
    try {
      const priceUnit = await this.prisma.priceUnit.create({
        data: {
          code,
          label: dto.label.trim(),
          aliases: this.normalizeAliases(dto.aliases),
          packageType: dto.packageType,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
      await this.refresh();

      return {
        message: 'Price unit created successfully.',
        priceUnit,
      };
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          `A price unit with code "${code}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePriceUnitDto) {
    try {
      const priceUnit = await this.prisma.priceUnit.update({
        where: { id },
        data: {
          code: dto.code ? normalizeUnitKey(dto.code) : undefined,
          label: dto.label?.trim(),
          aliases: dto.aliases ? this.normalizeAliases(dto.aliases) : undefined,
          packageType: dto.packageType,
          sortOrder: dto.sortOrder,
          isActive: dto.isActive,
        },
      });
      await this.refresh();

      return {
        message: 'Price unit updated successfully.',
        priceUnit,
      };
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException(
          `A price unit with code "${dto.code}" already exists`,
        );
      }
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Price unit not found');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.priceUnit.delete({ where: { id } });
      await this.refresh();

      return { message: 'Price unit deleted successfully.' };
    } catch (error) {
      if (this.isForeignKeyConstraint(error)) {
        throw new ConflictException(
          'This price unit is still referenced by prices, orders or wishlists and cannot be deleted. Deactivate it instead.',
        );
      }
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Price unit not found');
      }
      throw error;
    }
  }

  private normalizeAliases(aliases?: string[]): string[] {
    if (!aliases) return [];
    return [
      ...new Set(
        aliases
          .map((alias) => alias.trim().toLowerCase())
          .filter((alias) => alias.length > 0),
      ),
    ];
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isForeignKeyConstraint(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    );
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
