import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  sku: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
