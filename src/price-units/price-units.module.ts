import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PriceUnitsController } from './price-units.controller';
import { PriceUnitsService } from './price-units.service';
import { IsPriceUnitConstraint } from './validators/is-price-unit.validator';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PriceUnitsController],
  providers: [PriceUnitsService, IsPriceUnitConstraint],
  exports: [PriceUnitsService],
})
export class PriceUnitsModule {}
