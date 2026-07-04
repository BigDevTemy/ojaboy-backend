import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalApiTokenGuard } from '../common/guards/internal-api-token.guard';
import {
  CreateMarketAnalysisBenchmarkDto,
  RunMarketAnalysisDto,
  UpdateMarketAnalysisBenchmarkDto,
} from './dto/market-analysis.dto';
import { MarketAnalysisService } from './market-analysis.service';

@Controller('market-analysis')
export class MarketAnalysisController {
  constructor(private readonly service: MarketAnalysisService) {}

  @Get('latest')
  latest() {
    return this.service.latest();
  }

  @Post('benchmarks')
  @UseGuards(InternalApiTokenGuard)
  createBenchmark(@Body() dto: CreateMarketAnalysisBenchmarkDto) {
    return this.service.createBenchmark(dto);
  }

  @Get('benchmarks')
  @UseGuards(InternalApiTokenGuard)
  benchmarks() {
    return this.service.findBenchmarks();
  }

  @Patch('benchmarks/:id')
  @UseGuards(InternalApiTokenGuard)
  updateBenchmark(
    @Param('id') id: string,
    @Body() dto: UpdateMarketAnalysisBenchmarkDto,
  ) {
    return this.service.updateBenchmark(id, dto);
  }

  @Delete('benchmarks/:id')
  @UseGuards(InternalApiTokenGuard)
  removeBenchmark(@Param('id') id: string) {
    return this.service.removeBenchmark(id);
  }
}

@Controller('internal/jobs/market-analysis')
@UseGuards(InternalApiTokenGuard)
export class MarketAnalysisJobsController {
  constructor(private readonly service: MarketAnalysisService) {}

  @Post('daily')
  runDaily(@Body() dto: RunMarketAnalysisDto) {
    return this.service.runDaily(dto.analysisDate);
  }
}
