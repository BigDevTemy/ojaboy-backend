import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { MailModule } from '../mail/mail.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrdersController } from './orders.controller';
import { OrderQuoteNormalizerService } from './order-quote-normalizer.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [PrismaModule, MailModule, AddressesModule, PaymentsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderQuoteNormalizerService],
  exports: [OrdersService],
})
export class OrdersModule {}
