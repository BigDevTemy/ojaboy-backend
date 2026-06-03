import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InternalApiTokenGuard } from '../common/guards/internal-api-token.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
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
