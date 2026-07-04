import { PriceQualityGrade, PriceSource } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { IsPriceUnit } from '../../price-units/validators/is-price-unit.validator';

export class UpdateMarketPriceDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  productOfferingId?: string;

  @IsOptional()
  @IsUUID()
  marketId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsOptional()
  @IsPriceUnit()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsEnum(PriceQualityGrade)
  qualityGrade?: PriceQualityGrade;

  @IsOptional()
  @IsEnum(PriceSource)
  source?: PriceSource;

  @IsOptional()
  @IsDateString()
  observedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
