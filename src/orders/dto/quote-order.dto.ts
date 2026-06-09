import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

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
  @IsUUID()
  deliveryZoneId?: string;
}
