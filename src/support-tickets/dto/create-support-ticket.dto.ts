import { SupportTicketCategory, SupportTicketPriority } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  subject: string;

  @IsEnum(SupportTicketCategory)
  category: SupportTicketCategory;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority: SupportTicketPriority = SupportTicketPriority.normal;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsUUID()
  @IsNotEmpty()
  orderId?: string;
}
