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

/**
 * Either a quantity-based item (buyPriceId + quantity, priced from the
 * matching BuyPrice as usual) or an amount-based item (productId + amount,
 * e.g. "N2000 tomatoes" from free-text parsing) - the customer states the
 * total directly, so no per-unit price is looked up or calculated.
 */
export class QuoteOrderItemDto {
  @ValidateIf((dto: QuoteOrderItemDto) => dto.amount === undefined)
  @IsUUID()
  buyPriceId?: string;

  @ValidateIf((dto: QuoteOrderItemDto) => dto.amount !== undefined)
  @IsUUID()
  productId?: string;

  @ValidateIf((dto: QuoteOrderItemDto) => dto.amount === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity?: number;

  @ValidateIf((dto: QuoteOrderItemDto) => dto.quantity === undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount?: number;
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
