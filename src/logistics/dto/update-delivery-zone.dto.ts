import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDeliveryZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
