import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { QuoteAddressDto } from '../../addresses/dto/address-details.dto';

export class QuoteOrderItemDto {
  @IsUUID()
  buyPriceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;
}

export class QuoteOrderDto {
  @ValidateIf((dto: QuoteOrderDto) => !dto.orderText)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteOrderItemDto)
  items: QuoteOrderItemDto[];

  @ValidateIf((dto: QuoteOrderDto) => !dto.items?.length)
  @IsString()
  @MinLength(1)
  orderText?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @Transform(({ value }) => normalizeOptionalAddress(value))
  @ValidateNested()
  @Type(() => QuoteAddressDto)
  deliveryAddress?: QuoteAddressDto;
}

export function normalizeOptionalAddress(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const fields = Object.values(value as Record<string, unknown>);
  const hasValue = fields.some((field) => {
    if (typeof field === 'string') {
      return field.trim().length > 0;
    }

    if (field && typeof field === 'object') {
      return Object.keys(field).length > 0;
    }

    return field !== null && field !== undefined;
  });

  return hasValue ? value : undefined;
}
