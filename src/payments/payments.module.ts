import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ChargeController } from './charge.controller';
import { PaystackWebhookController } from './paystack-webhook.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [
    PaymentsController,
    ChargeController,
    PaystackWebhookController,
  ],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
