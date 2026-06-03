import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketPricesController } from './market-prices.controller';
import { MarketPricesService } from './market-prices.service';

@Module({
  imports: [PrismaModule],
  controllers: [MarketPricesController],
  providers: [MarketPricesService],
})
export class MarketPricesModule {}
