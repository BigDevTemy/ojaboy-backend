import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { appRoles } from '../../access-control/roles';
import type { AppRole } from '../../access-control/roles';

export class UserListQueryDto {
  @IsOptional()
  @IsIn(appRoles)
  role?: AppRole;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
