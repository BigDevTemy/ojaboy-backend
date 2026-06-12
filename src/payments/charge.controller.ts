import { Body, Controller, Post } from '@nestjs/common';
import { CreateChargeDto } from './dto/create-charge.dto';
import { PaymentsService } from './payments.service';

@Controller('charge')
export class ChargeController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  charge(@Body() dto: CreateChargeDto) {
    return this.paymentsService.charge(dto);
  }
}
