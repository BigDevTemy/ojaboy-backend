import { OrderStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
} from 'class-validator';

export class BulkUpdateOrderStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  orderIds: string[];

  @IsEnum(OrderStatus)
  status: OrderStatus;
}
