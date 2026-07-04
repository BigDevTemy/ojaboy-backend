import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CatalogueBulkController } from './catalogue-bulk.controller';
import { CatalogueBulkService } from './catalogue-bulk.service';
import { CatalogueController } from './catalogue.controller';
import { CatalogueService } from './catalogue.service';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogueController, CatalogueBulkController],
  providers: [CatalogueService, CatalogueBulkService],
})
export class CatalogueModule {}
