import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CreateMarketPriceDto } from './dto/create-market-price.dto';
import { MarketPricesBulkService } from './market-prices-bulk.service';
import { UpdateMarketPriceDto } from './dto/update-market-price.dto';
import { MarketPricesService } from './market-prices.service';

@Controller('market-prices')
export class MarketPricesController {
  constructor(
    private readonly marketPricesService: MarketPricesService,
    private readonly marketPricesBulkService: MarketPricesBulkService,
  ) {}

  @Post()
  create(@Body() createMarketPriceDto: CreateMarketPriceDto) {
    return this.marketPricesService.create(createMarketPriceDto);
  }

  @Get()
  findAll(
    @Query('productId') productId?: string,
    @Query('productOfferingId') productOfferingId?: string,
    @Query('variantId') variantId?: string,
    @Query('brandId') brandId?: string,
    @Query('packageId') packageId?: string,
    @Query('marketId') marketId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.marketPricesService.findAll({
      productId,
      productOfferingId,
      variantId,
      brandId,
      packageId,
      marketId,
      from,
      to,
    });
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.marketPricesService.findByProduct(productId);
  }

  @Get('market/:marketId')
  findByMarket(@Param('marketId') marketId: string) {
    return this.marketPricesService.findByMarket(marketId);
  }

  @Get('bulk-upload/template')
  async downloadBulkTemplate(@Res() response: Response) {
    const template = await this.marketPricesBulkService.createTemplate();
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="market-prices-bulk-upload-template.xlsx"',
    );
    response.send(template);
  }

  @Post('bulk-upload/validate')
  @UseInterceptors(FileInterceptor('file'))
  validateBulkUpload(@UploadedFile() file?: Express.Multer.File) {
    return this.marketPricesBulkService.validate(file);
  }

  @Post('bulk-upload/commit')
  @UseInterceptors(FileInterceptor('file'))
  commitBulkUpload(@UploadedFile() file?: Express.Multer.File) {
    return this.marketPricesBulkService.commit(file);
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
