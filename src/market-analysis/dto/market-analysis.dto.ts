import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateMarketAnalysisBenchmarkDto {
  @IsUUID()
  productOfferingId: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  marketIds: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMarketAnalysisBenchmarkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  marketIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RunMarketAnalysisDto {
  @IsOptional()
  @IsDateString()
  analysisDate?: string;
}
