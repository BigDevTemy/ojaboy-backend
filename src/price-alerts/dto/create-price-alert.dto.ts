import { PriceAlertCondition, PriceUnit } from '@prisma/client';
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

export class CreatePriceAlertDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetPrice: number;

  @IsEnum(PriceUnit)
  unit: PriceUnit;

  @IsOptional()
  @IsEnum(PriceAlertCondition)
  condition?: PriceAlertCondition;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;
}
