import { MarketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMarketDto {
  @IsString()
  @MinLength(1)
  marketname: string;

  @IsOptional()
  @IsString()
  marketaddress?: string;

  @IsOptional()
  @IsEnum(MarketStatus)
  status?: MarketStatus;
}
