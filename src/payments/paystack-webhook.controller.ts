import { Body, Controller, Headers, Post, RawBody } from '@nestjs/common';
import { PaymentsService } from './payments.service';

@Controller('webhook/paystack')
export class PaystackWebhookController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  webhook(
    @Body() payload: Record<string, unknown>,
    @Headers('x-paystack-signature') signature: string | undefined,
    @RawBody() rawBody: Buffer | undefined,
  ) {
    return this.paymentsService.webhook(payload, signature, rawBody);
  }
}
