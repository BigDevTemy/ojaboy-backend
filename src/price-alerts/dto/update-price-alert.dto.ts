import {
  PriceAlertCondition,
  PriceAlertFrequency,
  PriceAlertStatus,
} from '@prisma/client';
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

export class UpdatePriceAlertDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @IsOptional()
  @IsUUID()
  productOfferingId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetPrice?: number;

  @IsOptional()
  @IsPriceUnit()
  unit?: string;

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
