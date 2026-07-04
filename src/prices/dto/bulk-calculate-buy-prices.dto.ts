import { BuyPriceStrategy } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsPriceUnit } from '../../price-units/validators/is-price-unit.validator';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class MarketLogisticsCostDto {
  @IsUUID()
  marketId: string;

  @IsNumber()
  @Min(0)
  cost: number;
}

export class BulkCalculateBuyPricesDto {
  @IsEnum(BuyPriceStrategy)
  strategy: BuyPriceStrategy;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  productIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  productOfferingIds?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsPriceUnit()
  unit?: string;

  @IsOptional()
  @IsUUID()
  preferredMarketId?: string;

  @IsOptional()
  @IsUUID()
  marketId?: string;

  @IsOptional()
  @IsUUID()
  deliveryZoneId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  marketPriorityIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarketLogisticsCostDto)
  marketLogisticsCosts?: MarketLogisticsCostDto[];

  @IsOptional()
  @IsDateString()
  observedFrom?: string;

  @IsOptional()
  @IsDateString()
  observedTo?: string;

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
  @IsString()
  @MinLength(3)
  currency?: string;

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
