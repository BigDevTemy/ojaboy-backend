import {
  NotificationChannel,
  NotificationPriority,
  NotificationSource,
  NotificationStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsEnum(NotificationSource)
  source?: NotificationSource;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  event?: string;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  priceAlertId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  paymentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
