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
import { Throttle } from '@nestjs/throttler';
import { BulkPriceJobMode } from '@prisma/client';
import { BulkPriceJobsService } from './bulk-price-jobs.service';
import { BulkCalculateBuyPricesDto } from './dto/bulk-calculate-buy-prices.dto';
import { BuyPriceQueryDto } from './dto/buy-price-query.dto';
import { CalculateBuyPriceDto } from './dto/calculate-buy-price.dto';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PricesService } from './prices.service';

@Controller('buy-prices')
@Throttle({ default: { limit: 300, ttl: 60000 } })
export class PricesController {
  constructor(
    private readonly pricesService: PricesService,
    private readonly bulkPriceJobsService: BulkPriceJobsService,
  ) {}

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

  // Resumable alternative to calculate-bulk/generate-bulk: create a job,
  // then have the frontend call process-next repeatedly to drive it
  // forward in small batches with visible progress, instead of one request
  // blocking until every offering is done.
  @Post('bulk-jobs/calculate')
  createCalculateJob(
    @Body() bulkCalculateBuyPricesDto: BulkCalculateBuyPricesDto,
  ) {
    return this.bulkPriceJobsService.createJob(
      bulkCalculateBuyPricesDto,
      BulkPriceJobMode.calculate,
    );
  }

  @Post('bulk-jobs/generate')
  createGenerateJob(
    @Body() bulkCalculateBuyPricesDto: BulkCalculateBuyPricesDto,
  ) {
    return this.bulkPriceJobsService.createJob(
      bulkCalculateBuyPricesDto,
      BulkPriceJobMode.generate,
    );
  }

  @Post('bulk-jobs/:jobId/process-next')
  processNextBatch(@Param('jobId') jobId: string) {
    return this.bulkPriceJobsService.processNextBatch(jobId);
  }

  @Get('bulk-jobs/:jobId')
  getBulkJob(@Param('jobId') jobId: string) {
    return this.bulkPriceJobsService.getJob(jobId);
  }

  @Get()
  findAll(@Query() query: BuyPriceQueryDto) {
    return this.pricesService.findAll(query);
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
