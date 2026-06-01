import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { UpdateMarketDto } from './dto/update-market.dto';

@Injectable()
export class MarketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMarketDto: CreateMarketDto) {
    const market = await this.prisma.market.create({
      data: this.toMarketData(createMarketDto),
    });

    return {
      message: 'Market created successfully.',
      market,
    };
  }

  async findAll() {
    const markets = await this.prisma.market.findMany({
      orderBy: { marketname: 'asc' },
    });

    return { data: markets };
  }

  async findOne(id: string) {
    const market = await this.prisma.market.findUnique({
      where: { id },
    });

    if (!market) {
      throw new NotFoundException('Market not found');
    }

    return { market };
  }

  async update(id: string, updateMarketDto: UpdateMarketDto) {
    try {
      const market = await this.prisma.market.update({
        where: { id },
        data: this.toUpdateData(updateMarketDto),
      });

      return {
        message: 'Market updated successfully.',
        market,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market not found');
      }

      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.market.delete({
        where: { id },
      });

      return {
        message: 'Market deleted successfully.',
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('Market not found');
      }

      throw error;
    }
  }

  private toMarketData(
    dto: CreateMarketDto,
  ): Prisma.MarketUncheckedCreateInput {
    return {
      marketname: dto.marketname.trim(),
      marketaddress: dto.marketaddress?.trim(),
      status: dto.status,
    };
  }

  private toUpdateData(dto: UpdateMarketDto): Prisma.MarketUncheckedUpdateInput {
    return {
      marketname: dto.marketname?.trim(),
      marketaddress: dto.marketaddress?.trim(),
      status: dto.status,
    };
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
