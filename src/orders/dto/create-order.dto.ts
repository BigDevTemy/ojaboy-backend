import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { QuoteOrderDto } from './quote-order.dto';

export class CreateOrderDto extends QuoteOrderDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(32)
  orderToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
