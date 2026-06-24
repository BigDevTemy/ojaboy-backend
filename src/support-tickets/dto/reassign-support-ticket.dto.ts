import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ReassignSupportTicketDto {
  @IsUUID()
  @IsNotEmpty()
  assignedToId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
