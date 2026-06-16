import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { CreatePriceAlertDto } from './dto/create-price-alert.dto';
import { PriceAlertQueryDto } from './dto/price-alert-query.dto';
import { UpdatePriceAlertDto } from './dto/update-price-alert.dto';
import { PriceAlertsService } from './price-alerts.service';

@Controller('price-alerts')
@UseGuards(JwtAuthGuard)
export class PriceAlertsController {
  constructor(private readonly priceAlertsService: PriceAlertsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceAlertDto) {
    return this.priceAlertsService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: PriceAlertQueryDto) {
    return this.priceAlertsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.priceAlertsService.findOne(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePriceAlertDto,
  ) {
    return this.priceAlertsService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.priceAlertsService.remove(user.id, id);
  }
}
