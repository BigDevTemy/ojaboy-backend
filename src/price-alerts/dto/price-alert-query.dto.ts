import { PriceAlertStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class PriceAlertQueryDto {
  @IsOptional()
  @IsEnum(PriceAlertStatus)
  status?: PriceAlertStatus;

  @IsOptional()
  @IsString()
  productId?: string;
}
