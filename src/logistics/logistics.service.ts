import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto';
import { CreateDeliveryAreaDto } from './dto/create-delivery-area.dto';
import { CreateMarketDeliveryCostDto } from './dto/create-market-delivery-cost.dto';
import { CreateMarketRouteCostDto } from './dto/create-market-route-cost.dto';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto';
import { UpdateDeliveryAreaDto } from './dto/update-delivery-area.dto';
import { UpdateMarketDeliveryCostDto } from './dto/update-market-delivery-cost.dto';
import { UpdateMarketRouteCostDto } from './dto/update-market-route-cost.dto';

@Injectable()
export class LogisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async createDeliveryZone(dto: CreateDeliveryZoneDto) {
    const deliveryZone = await this.prisma.deliveryZone.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        deliveryCost: dto.deliveryCost,
        isActive: dto.isActive,
      },
    });

    return { message: 'Delivery zone created successfully.', deliveryZone };
  }

  async createDeliveryArea(dto: CreateDeliveryAreaDto) {
    const deliveryArea = await this.prisma.deliveryArea.create({
      data: {
        deliveryZoneId: dto.deliveryZoneId,
        name: dto.name.trim(),
        normalizedName: this.normalizeAreaName(dto.name),
        aliases: this.normalizeAliases(dto.aliases),
        locality: dto.locality?.trim(),
        state: dto.state.trim(),
        country: dto.country?.trim(),
        isActive: dto.isActive,
      },
      include: { deliveryZone: true },
    });

    return {
      message: 'Delivery area created successfully.',
      deliveryArea,
    };
  }

  async findDeliveryAreas(deliveryZoneId?: string) {
    const deliveryAreas = await this.prisma.deliveryArea.findMany({
      where: { deliveryZoneId },
      include: { deliveryZone: true },
      orderBy: { name: 'asc' },
    });

    return { data: deliveryAreas };
  }

  async updateDeliveryArea(id: string, dto: UpdateDeliveryAreaDto) {
    try {
      const deliveryArea = await this.prisma.deliveryArea.update({
        where: { id },
        data: {
          deliveryZoneId: dto.deliveryZoneId,
          name: dto.name?.trim(),
          normalizedName: dto.name
            ? this.normalizeAreaName(dto.name)
            : undefined,
          aliases: dto.aliases ? this.normalizeAliases(dto.aliases) : undefined,
          locality: dto.locality?.trim(),
          state: dto.state?.trim(),
          country: dto.country?.trim(),
          isActive: dto.isActive,
        },
        include: { deliveryZone: true },
      });

      return {
        message: 'Delivery area updated successfully.',
        deliveryArea,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Delivery area not found');
      }
      throw error;
    }
  }

  async removeDeliveryArea(id: string) {
    try {
      await this.prisma.deliveryArea.delete({ where: { id } });
      return { message: 'Delivery area deleted successfully.' };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Delivery area not found');
      }
      throw error;
    }
  }

  async findDeliveryZones() {
    const deliveryZones = await this.prisma.deliveryZone.findMany({
      include: { deliveryCosts: true },
      orderBy: { name: 'asc' },
    });

    return { data: deliveryZones };
  }

  async findDeliveryZone(id: string) {
    const deliveryZone = await this.prisma.deliveryZone.findUnique({
      where: { id },
      include: { deliveryCosts: { include: { market: true } } },
    });

    if (!deliveryZone) throw new NotFoundException('Delivery zone not found');

    return { deliveryZone };
  }

  async updateDeliveryZone(id: string, dto: UpdateDeliveryZoneDto) {
    try {
      const deliveryZone = await this.prisma.deliveryZone.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description?.trim(),
          deliveryCost: dto.deliveryCost,
          isActive: dto.isActive,
        },
      });

      return { message: 'Delivery zone updated successfully.', deliveryZone };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Delivery zone not found');
      }
      throw error;
    }
  }

  async removeDeliveryZone(id: string) {
    try {
      await this.prisma.deliveryZone.delete({ where: { id } });
      return { message: 'Delivery zone deleted successfully.' };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Delivery zone not found');
      }
      throw error;
    }
  }

  async createMarketDeliveryCost(dto: CreateMarketDeliveryCostDto) {
    const marketDeliveryCost = await this.prisma.marketDeliveryCost.create({
      data: {
        marketId: dto.marketId,
        deliveryZoneId: dto.deliveryZoneId,
        cost: dto.cost,
        currency: dto.currency?.trim().toUpperCase(),
        estimatedMinutes: dto.estimatedMinutes,
        isActive: dto.isActive,
      },
      include: { market: true, deliveryZone: true },
    });

    return {
      message: 'Market delivery cost created successfully.',
      marketDeliveryCost,
    };
  }

  async findMarketDeliveryCosts(filters: {
    marketId?: string;
    deliveryZoneId?: string;
  }) {
    const marketDeliveryCosts = await this.prisma.marketDeliveryCost.findMany({
      where: filters,
      include: { market: true, deliveryZone: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: marketDeliveryCosts };
  }

  async findMarketDeliveryCost(id: string) {
    const marketDeliveryCost = await this.prisma.marketDeliveryCost.findUnique({
      where: { id },
      include: { market: true, deliveryZone: true },
    });

    if (!marketDeliveryCost) {
      throw new NotFoundException('Market delivery cost not found');
    }

    return { marketDeliveryCost };
  }

  async updateMarketDeliveryCost(id: string, dto: UpdateMarketDeliveryCostDto) {
    try {
      const marketDeliveryCost = await this.prisma.marketDeliveryCost.update({
        where: { id },
        data: {
          marketId: dto.marketId,
          deliveryZoneId: dto.deliveryZoneId,
          cost: dto.cost,
          currency: dto.currency?.trim().toUpperCase(),
          estimatedMinutes: dto.estimatedMinutes,
          isActive: dto.isActive,
        },
        include: { market: true, deliveryZone: true },
      });

      return {
        message: 'Market delivery cost updated successfully.',
        marketDeliveryCost,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market delivery cost not found');
      }
      throw error;
    }
  }

  async removeMarketDeliveryCost(id: string) {
    try {
      await this.prisma.marketDeliveryCost.delete({ where: { id } });
      return { message: 'Market delivery cost deleted successfully.' };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market delivery cost not found');
      }
      throw error;
    }
  }

  async createMarketRouteCost(dto: CreateMarketRouteCostDto) {
    const marketRouteCost = await this.prisma.marketRouteCost.create({
      data: {
        fromMarketId: dto.fromMarketId,
        toMarketId: dto.toMarketId,
        cost: dto.cost,
        currency: dto.currency?.trim().toUpperCase(),
        estimatedMinutes: dto.estimatedMinutes,
        isActive: dto.isActive,
      },
      include: { fromMarket: true, toMarket: true },
    });

    return {
      message: 'Market route cost created successfully.',
      marketRouteCost,
    };
  }

  async findMarketRouteCosts(filters: {
    fromMarketId?: string;
    toMarketId?: string;
  }) {
    const marketRouteCosts = await this.prisma.marketRouteCost.findMany({
      where: filters,
      include: { fromMarket: true, toMarket: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: marketRouteCosts };
  }

  async findMarketRouteCost(id: string) {
    const marketRouteCost = await this.prisma.marketRouteCost.findUnique({
      where: { id },
      include: { fromMarket: true, toMarket: true },
    });

    if (!marketRouteCost)
      throw new NotFoundException('Market route cost not found');

    return { marketRouteCost };
  }

  async updateMarketRouteCost(id: string, dto: UpdateMarketRouteCostDto) {
    try {
      const marketRouteCost = await this.prisma.marketRouteCost.update({
        where: { id },
        data: {
          fromMarketId: dto.fromMarketId,
          toMarketId: dto.toMarketId,
          cost: dto.cost,
          currency: dto.currency?.trim().toUpperCase(),
          estimatedMinutes: dto.estimatedMinutes,
          isActive: dto.isActive,
        },
        include: { fromMarket: true, toMarket: true },
      });

      return {
        message: 'Market route cost updated successfully.',
        marketRouteCost,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market route cost not found');
      }
      throw error;
    }
  }

  async removeMarketRouteCost(id: string) {
    try {
      await this.prisma.marketRouteCost.delete({ where: { id } });
      return { message: 'Market route cost deleted successfully.' };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market route cost not found');
      }
      throw error;
    }
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }

  private normalizeAliases(aliases?: string[]): string[] {
    return [
      ...new Set(
        (aliases ?? [])
          .map((alias) => this.normalizeAreaName(alias))
          .filter(Boolean),
      ),
    ];
  }

  private normalizeAreaName(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ');
  }
}
