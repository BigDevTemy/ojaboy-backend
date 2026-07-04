import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreatePriceUnitDto } from './dto/create-price-unit.dto';
import { UpdatePriceUnitDto } from './dto/update-price-unit.dto';
import { PriceUnitsService } from './price-units.service';

@Controller('price-units')
export class PriceUnitsController {
  constructor(private readonly priceUnitsService: PriceUnitsService) {}

  @Post()
  create(@Body() dto: CreatePriceUnitDto) {
    return this.priceUnitsService.create(dto);
  }

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    if (
      includeInactive !== undefined &&
      !['true', 'false'].includes(includeInactive)
    ) {
      throw new BadRequestException('includeInactive must be true or false');
    }

    return this.priceUnitsService.findAll(includeInactive !== 'false');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.priceUnitsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePriceUnitDto) {
    return this.priceUnitsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.priceUnitsService.remove(id);
  }
}
