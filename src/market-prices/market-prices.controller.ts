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
import { CreateMarketPriceDto } from './dto/create-market-price.dto';
import { UpdateMarketPriceDto } from './dto/update-market-price.dto';
import { MarketPricesService } from './market-prices.service';

@Controller('market-prices')
export class MarketPricesController {
  constructor(private readonly marketPricesService: MarketPricesService) {}

  @Post()
  create(@Body() createMarketPriceDto: CreateMarketPriceDto) {
    return this.marketPricesService.create(createMarketPriceDto);
  }

  @Get()
  findAll(
    @Query('productId') productId?: string,
    @Query('marketId') marketId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.marketPricesService.findAll({ productId, marketId, from, to });
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.marketPricesService.findByProduct(productId);
  }

  @Get('market/:marketId')
  findByMarket(@Param('marketId') marketId: string) {
    return this.marketPricesService.findByMarket(marketId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.marketPricesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMarketPriceDto: UpdateMarketPriceDto,
  ) {
    return this.marketPricesService.update(id, updateMarketPriceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marketPricesService.remove(id);
  }
}
