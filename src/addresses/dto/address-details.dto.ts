import { Transform, Type } from 'class-transformer';
import {
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AddressLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  formattedAddress: string;

  @IsString()
  @MinLength(1)
  @MaxLength(250)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  streetNumber?: string;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  sublocality?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  localGovernmentArea?: string;

  @IsOptional()
  @IsString()
  administrativeArea?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsString()
  @MinLength(2)
  country: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  countryCode?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsString()
  @MinLength(1)
  googlePlaceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsObject()
  @IsNotEmptyObject()
  googleAddressData?: Record<string, unknown>;
}

export class QuoteAddressDto extends AddressLocationDto {
  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  recipientName?: string;

  @IsOptional()
  @Transform(({ value }) => emptyStringToUndefined(value))
  @IsPhoneNumber()
  phoneNumber?: string;
}

export class AddressDetailsDto extends AddressLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  recipientName: string;

  @IsPhoneNumber()
  phoneNumber: string;
}

function emptyStringToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}
