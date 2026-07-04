import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BulkPriceJobsService } from './bulk-price-jobs.service';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [PrismaModule],
  controllers: [PricesController],
  providers: [PricesService, BulkPriceJobsService],
})
export class PricesModule {}
