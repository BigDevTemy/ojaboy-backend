import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

class BankTransferDto {
  @IsOptional()
  @IsDateString()
  account_expires_at?: string;
}

export class CreateChargeDto {
  @IsEmail()
  email: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsString()
  @Matches(/^[A-Za-z0-9.\-=]+$/, {
    message:
      'reference can contain only letters, numbers, hyphens, dots, and equals signs',
  })
  reference: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BankTransferDto)
  bank_transfer?: BankTransferDto;
}
