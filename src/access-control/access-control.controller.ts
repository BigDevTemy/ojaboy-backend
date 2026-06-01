import { Body, Controller, Get, Post } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { AddPermissionsToUserDto } from './dto/add-permissions-to-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Controller('access-control')
export class AccessControlController {
  constructor(private readonly accessControlService: AccessControlService) {}

  @Get('roles')
  getRoles() {
    return this.accessControlService.getRoles();
  }

  @Post('roles')
  assignRole(@Body() assignRoleDto: AssignRoleDto) {
    return this.accessControlService.assignRole(assignRoleDto);
  }

  @Get('permission')
  getPermissions() {
    return this.accessControlService.getPermissions();
  }

  @Post('permission')
  createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.accessControlService.createPermission(createPermissionDto);
  }

  @Post('add-permissions-to-users')
  addPermissionsToUser(
    @Body() addPermissionsToUserDto: AddPermissionsToUserDto,
  ) {
    return this.accessControlService.addPermissionsToUser(
      addPermissionsToUserDto,
    );
  }
}
