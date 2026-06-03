import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { BulkCalculateBuyPricesDto } from './dto/bulk-calculate-buy-prices.dto';
import { CalculateBuyPriceDto } from './dto/calculate-buy-price.dto';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PricesService } from './prices.service';

@Controller('buy-prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Post()
  create(@Body() createPriceDto: CreatePriceDto) {
    return this.pricesService.create(createPriceDto);
  }

  @Post('calculate')
  calculate(@Body() calculateBuyPriceDto: CalculateBuyPriceDto) {
    return this.pricesService.calculate(calculateBuyPriceDto);
  }

  @Post('generate')
  generate(@Body() calculateBuyPriceDto: CalculateBuyPriceDto) {
    return this.pricesService.generate(calculateBuyPriceDto);
  }

  @Post('calculate-bulk')
  calculateBulk(@Body() bulkCalculateBuyPricesDto: BulkCalculateBuyPricesDto) {
    return this.pricesService.calculateBulk(bulkCalculateBuyPricesDto);
  }

  @Post('generate-bulk')
  generateBulk(@Body() bulkCalculateBuyPricesDto: BulkCalculateBuyPricesDto) {
    return this.pricesService.generateBulk(bulkCalculateBuyPricesDto);
  }

  @Get()
  findAll() {
    return this.pricesService.findAll();
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.pricesService.findByProduct(productId);
  }

  @Get('product/:productId/active')
  findActiveByProduct(@Param('productId') productId: string) {
    return this.pricesService.findActiveByProduct(productId);
  }

  @Get('market/:marketId')
  findByMarket(@Param('marketId') marketId: string) {
    return this.pricesService.findByMarket(marketId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pricesService.findOne(id);
  }

  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.pricesService.activate(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePriceDto: UpdatePriceDto) {
    return this.pricesService.update(id, updatePriceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pricesService.remove(id);
  }
}
