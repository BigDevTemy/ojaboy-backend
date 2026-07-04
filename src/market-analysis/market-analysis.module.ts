import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  MarketAnalysisController,
  MarketAnalysisJobsController,
} from './market-analysis.controller';
import { MarketAnalysisService } from './market-analysis.service';

@Module({
  imports: [PrismaModule],
  controllers: [MarketAnalysisController, MarketAnalysisJobsController],
  providers: [MarketAnalysisService],
})
export class MarketAnalysisModule {}
