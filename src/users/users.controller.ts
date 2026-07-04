import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InternalApiTokenGuard } from '../common/guards/internal-api-token.guard';
import { UserListQueryDto } from './dto/user-list-query.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: AuthUser, @Query() query: UserListQueryDto) {
    return this.usersService.findAll(user, query);
  }

  @Get('email/:email')
  @UseGuards(InternalApiTokenGuard)
  findByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @Get('email/:email/orders')
  @UseGuards(InternalApiTokenGuard)
  findOrdersByEmail(@Param('email') email: string) {
    return this.usersService.findOrdersByEmail(email);
  }

  @Get('email/:email/orders/last')
  @UseGuards(InternalApiTokenGuard)
  findLastOrderByEmail(@Param('email') email: string) {
    return this.usersService.findLastOrderByEmail(email);
  }
}
