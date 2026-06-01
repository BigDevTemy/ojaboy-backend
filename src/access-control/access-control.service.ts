import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddPermissionsToUserDto } from './dto/add-permissions-to-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { appRoles } from './roles';

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  getRoles() {
    return {
      data: appRoles.map((role) => ({ name: role })),
    };
  }

  async assignRole(assignRoleDto: AssignRoleDto) {
    try {
      const user = await this.prisma.user.update({
        where: { id: assignRoleDto.userId },
        data: { role: assignRoleDto.role },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
        },
      });

      return {
        message: 'Role assigned successfully.',
        user,
      };
    } catch (error) {
      if (this.isRecordNotFound(error)) {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return { data: permissions };
  }

  async createPermission(createPermissionDto: CreatePermissionDto) {
    const name = this.normalizePermissionName(createPermissionDto.name);

    try {
      const permission = await this.prisma.permission.create({
        data: {
          name,
          description: createPermissionDto.description?.trim(),
        },
      });

      return {
        message: 'Permission created successfully.',
        permission,
      };
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException('Permission already exists');
      }

      throw error;
    }
  }

  async addPermissionsToUser(addPermissionsToUserDto: AddPermissionsToUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: addPermissionsToUserDto.userId },
      select: { id: true, email: true, fullName: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissionNames = [
      ...new Set(
        addPermissionsToUserDto.permissions.map((permission) =>
          this.normalizePermissionName(permission),
        ),
      ),
    ];

    if (permissionNames.length === 0) {
      throw new BadRequestException('At least one permission is required');
    }

    const permissions = await Promise.all(
      permissionNames.map((name) =>
        this.prisma.permission.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );

    await Promise.all(
      permissions.map((permission) =>
        this.prisma.userPermission.upsert({
          where: {
            userId_permissionId: {
              userId: user.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            permissionId: permission.id,
          },
        }),
      ),
    );

    return {
      message: 'Permissions added to user successfully.',
      user,
      permissions,
    };
  }

  private normalizePermissionName(permission: string): string {
    return permission.trim().toLowerCase();
  }

  private isUniqueConstraint(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isRecordNotFound(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
