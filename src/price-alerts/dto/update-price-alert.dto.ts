import {
  PriceAlertCondition,
  PriceAlertFrequency,
  PriceAlertStatus,
  PriceUnit,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdatePriceAlertDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetPrice?: number;

  @IsOptional()
  @IsEnum(PriceUnit)
  unit?: PriceUnit;

  @IsOptional()
  @IsEnum(PriceAlertCondition)
  condition?: PriceAlertCondition;

  @IsOptional()
  @IsEnum(PriceAlertFrequency)
  frequency?: PriceAlertFrequency;

  @IsOptional()
  @IsEnum(PriceAlertStatus)
  status?: PriceAlertStatus;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;
}
