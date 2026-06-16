import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AddressDetailsDto } from '../../addresses/dto/address-details.dto';
import { normalizeOptionalAddress } from '../../orders/dto/quote-order.dto';

export class ConvertWishlistDto {
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalAddress(value))
  @ValidateNested()
  @Type(() => AddressDetailsDto)
  deliveryAddress?: AddressDetailsDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
