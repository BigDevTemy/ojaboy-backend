import { PriceQualityGrade, PriceSource, PriceUnit } from '@prisma/client';
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

export class CreateMarketPriceDto {
  @IsUUID()
  productId: string;

  @IsUUID()
  marketId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsEnum(PriceUnit)
  unit: PriceUnit;

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
