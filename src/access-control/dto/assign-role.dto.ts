import { IsIn, IsUUID } from 'class-validator';
import { appRoles } from '../roles';
import type { AppRole } from '../roles';

export class AssignRoleDto {
  @IsUUID()
  userId: string;

  @IsIn(appRoles, {
    message: `Role must be one of: ${appRoles.join(', ')}`,
  })
  role: AppRole;
}
