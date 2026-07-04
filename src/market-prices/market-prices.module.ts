import { Module } from '@nestjs/common';
import { PriceAlertsModule } from '../price-alerts/price-alerts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketPricesController } from './market-prices.controller';
import { MarketPricesBulkService } from './market-prices-bulk.service';
import { MarketPricesService } from './market-prices.service';

@Module({
  imports: [PrismaModule, PriceAlertsModule],
  controllers: [MarketPricesController],
  providers: [MarketPricesService, MarketPricesBulkService],
})
export class MarketPricesModule {}
