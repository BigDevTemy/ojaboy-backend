import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateDeliveryZoneDto } from './dto/create-delivery-zone.dto';
import { CreateDeliveryAreaDto } from './dto/create-delivery-area.dto';
import { CreateMarketDeliveryCostDto } from './dto/create-market-delivery-cost.dto';
import { CreateMarketRouteCostDto } from './dto/create-market-route-cost.dto';
import { UpdateDeliveryZoneDto } from './dto/update-delivery-zone.dto';
import { UpdateDeliveryAreaDto } from './dto/update-delivery-area.dto';
import { UpdateMarketDeliveryCostDto } from './dto/update-market-delivery-cost.dto';
import { UpdateMarketRouteCostDto } from './dto/update-market-route-cost.dto';
import { LogisticsService } from './logistics.service';

@Controller('logistics')
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('delivery-zones')
  createDeliveryZone(@Body() dto: CreateDeliveryZoneDto) {
    return this.logisticsService.createDeliveryZone(dto);
  }

  @Post('delivery-areas')
  createDeliveryArea(@Body() dto: CreateDeliveryAreaDto) {
    return this.logisticsService.createDeliveryArea(dto);
  }

  @Get('delivery-areas')
  findDeliveryAreas(@Query('deliveryZoneId') deliveryZoneId?: string) {
    return this.logisticsService.findDeliveryAreas(deliveryZoneId);
  }

  @Patch('delivery-areas/:id')
  updateDeliveryArea(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryAreaDto,
  ) {
    return this.logisticsService.updateDeliveryArea(id, dto);
  }

  @Delete('delivery-areas/:id')
  removeDeliveryArea(@Param('id') id: string) {
    return this.logisticsService.removeDeliveryArea(id);
  }

  @Get('delivery-zones')
  findDeliveryZones() {
    return this.logisticsService.findDeliveryZones();
  }

  @Get('delivery-zones/:id')
  findDeliveryZone(@Param('id') id: string) {
    return this.logisticsService.findDeliveryZone(id);
  }

  @Patch('delivery-zones/:id')
  updateDeliveryZone(
    @Param('id') id: string,
    @Body() dto: UpdateDeliveryZoneDto,
  ) {
    return this.logisticsService.updateDeliveryZone(id, dto);
  }

  @Delete('delivery-zones/:id')
  removeDeliveryZone(@Param('id') id: string) {
    return this.logisticsService.removeDeliveryZone(id);
  }

  @Post('market-delivery-costs')
  createMarketDeliveryCost(@Body() dto: CreateMarketDeliveryCostDto) {
    return this.logisticsService.createMarketDeliveryCost(dto);
  }

  @Get('market-delivery-costs')
  findMarketDeliveryCosts(
    @Query('marketId') marketId?: string,
    @Query('deliveryZoneId') deliveryZoneId?: string,
  ) {
    return this.logisticsService.findMarketDeliveryCosts({
      marketId,
      deliveryZoneId,
    });
  }

  @Get('market-delivery-costs/:id')
  findMarketDeliveryCost(@Param('id') id: string) {
    return this.logisticsService.findMarketDeliveryCost(id);
  }

  @Patch('market-delivery-costs/:id')
  updateMarketDeliveryCost(
    @Param('id') id: string,
    @Body() dto: UpdateMarketDeliveryCostDto,
  ) {
    return this.logisticsService.updateMarketDeliveryCost(id, dto);
  }

  @Delete('market-delivery-costs/:id')
  removeMarketDeliveryCost(@Param('id') id: string) {
    return this.logisticsService.removeMarketDeliveryCost(id);
  }

  @Post('market-route-costs')
  createMarketRouteCost(@Body() dto: CreateMarketRouteCostDto) {
    return this.logisticsService.createMarketRouteCost(dto);
  }

  @Get('market-route-costs')
  findMarketRouteCosts(
    @Query('fromMarketId') fromMarketId?: string,
    @Query('toMarketId') toMarketId?: string,
  ) {
    return this.logisticsService.findMarketRouteCosts({
      fromMarketId,
      toMarketId,
    });
  }

  @Get('market-route-costs/:id')
  findMarketRouteCost(@Param('id') id: string) {
    return this.logisticsService.findMarketRouteCost(id);
  }

  @Patch('market-route-costs/:id')
  updateMarketRouteCost(
    @Param('id') id: string,
    @Body() dto: UpdateMarketRouteCostDto,
  ) {
    return this.logisticsService.updateMarketRouteCost(id, dto);
  }

  @Delete('market-route-costs/:id')
  removeMarketRouteCost(@Param('id') id: string) {
    return this.logisticsService.removeMarketRouteCost(id);
  }
}
