import { BuyPriceStrategy, PriceUnit } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePriceDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsUUID()
  marketId?: string;

  @IsOptional()
  @IsUUID()
  marketPriceId?: string;

  @IsNumber()
  @Min(0)
  baseMarketPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marginAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  logisticsBuffer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  riskBuffer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsEnum(PriceUnit)
  unit: PriceUnit;

  @IsOptional()
  @IsEnum(BuyPriceStrategy)
  strategyUsed?: BuyPriceStrategy;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
