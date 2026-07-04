import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { IsPriceUnit } from '../../price-units/validators/is-price-unit.validator';

export class UpdateWishlistItemDto {
  @IsOptional()
  @IsUUID()
  productOfferingId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @IsOptional()
  @IsPriceUnit()
  unit?: string;
}
