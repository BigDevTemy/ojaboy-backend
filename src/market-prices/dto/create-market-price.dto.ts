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

export class CreateMarketPriceDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  productOfferingId: string;

  @IsUUID()
  marketId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsPriceUnit()
  unit: string;

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

  @IsDateString()
  observedAt: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
