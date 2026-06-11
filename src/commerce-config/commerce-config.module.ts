import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CommerceConfigController } from './commerce-config.controller';
import { CommerceConfigService } from './commerce-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [CommerceConfigController],
  providers: [CommerceConfigService],
})
export class CommerceConfigModule {}
