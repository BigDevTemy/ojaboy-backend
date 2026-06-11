import { IsBoolean, IsOptional } from 'class-validator';
import { AddressDetailsDto } from './address-details.dto';

export class CreateAddressDto extends AddressDetailsDto {
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
