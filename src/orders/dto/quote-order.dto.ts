import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsEmail,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { AddressDetailsDto } from '../../addresses/dto/address-details.dto';

export class QuoteOrderItemDto {
  @IsUUID()
  buyPriceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}

export class QuoteOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteOrderItemDto)
  items: QuoteOrderItemDto[];

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDetailsDto)
  deliveryAddress?: AddressDetailsDto;
}
