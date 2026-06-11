import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateDeliveryAreaDto {
  @IsUUID()
  deliveryZoneId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  locality?: string;

  @IsString()
  @MinLength(1)
  state: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
