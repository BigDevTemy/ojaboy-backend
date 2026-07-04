import { PriceAlertCondition, PriceAlertFrequency } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { IsPriceUnit } from '../../price-units/validators/is-price-unit.validator';

export class CreatePriceAlertDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsUUID()
  productOfferingId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetPrice: number;

  @IsPriceUnit()
  unit: string;

  @IsOptional()
  @IsEnum(PriceAlertCondition)
  condition?: PriceAlertCondition;

  @IsOptional()
  @IsEnum(PriceAlertFrequency)
  frequency?: PriceAlertFrequency;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;
}
