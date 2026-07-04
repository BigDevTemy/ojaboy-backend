import { AnnouncementAudienceType, AnnouncementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

class AnnouncementAudienceDto {
  @IsEnum(AnnouncementAudienceType)
  type: AnnouncementAudienceType;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50000)
  @IsUUID(undefined, { each: true })
  userIds?: string[];
}

export class CreateAnnouncementDto {
  @IsEnum(AnnouncementType)
  type: AnnouncementType;

  @IsString()
  @MinLength(1)
  title: string;

  @IsString()
  @MinLength(1)
  body: string;

  @ValidateNested()
  @Type(() => AnnouncementAudienceDto)
  audience: AnnouncementAudienceDto;

  @IsOptional()
  @IsObject()
  templateVariables?: Record<string, string | number>;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
