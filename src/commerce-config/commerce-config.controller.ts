import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalApiTokenGuard } from '../common/guards/internal-api-token.guard';
import { CommerceConfigService } from './commerce-config.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateServiceFeeRuleDto } from './dto/create-service-fee-rule.dto';

@Controller('commerce-config')
@UseGuards(InternalApiTokenGuard)
export class CommerceConfigController {
  constructor(private readonly commerceConfigService: CommerceConfigService) {}

  @Post('service-fee-rules')
  createServiceFeeRule(@Body() dto: CreateServiceFeeRuleDto) {
    return this.commerceConfigService.createServiceFeeRule(dto);
  }

  @Get('service-fee-rules')
  findServiceFeeRules() {
    return this.commerceConfigService.findServiceFeeRules();
  }

  @Patch('service-fee-rules/:id/activate')
  activateServiceFeeRule(@Param('id') id: string) {
    return this.commerceConfigService.activateServiceFeeRule(id);
  }

  @Post('coupons')
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.commerceConfigService.createCoupon(dto);
  }

  @Get('coupons')
  findCoupons() {
    return this.commerceConfigService.findCoupons();
  }

  @Patch('coupons/:id/toggle')
  toggleCoupon(@Param('id') id: string) {
    return this.commerceConfigService.toggleCoupon(id);
  }

  @Post('promotions')
  createPromotion(@Body() dto: CreatePromotionDto) {
    return this.commerceConfigService.createPromotion(dto);
  }

  @Get('promotions')
  findPromotions() {
    return this.commerceConfigService.findPromotions();
  }

  @Patch('promotions/:id/toggle')
  togglePromotion(@Param('id') id: string) {
    return this.commerceConfigService.togglePromotion(id);
  }
}
