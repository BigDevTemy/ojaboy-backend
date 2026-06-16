import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { QuoteAddressDto } from '../../addresses/dto/address-details.dto';
import { normalizeOptionalAddress } from '../../orders/dto/quote-order.dto';

export class QuoteWishlistDto {
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalAddress(value))
  @ValidateNested()
  @Type(() => QuoteAddressDto)
  deliveryAddress?: QuoteAddressDto;
}
