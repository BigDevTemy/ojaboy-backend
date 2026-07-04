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
import { InternalOrJwtGuard } from '../common/guards/internal-or-jwt.guard';
import { CommerceConfigService } from './commerce-config.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { CreateServiceFeeRuleDto } from './dto/create-service-fee-rule.dto';

@Controller('commerce-config')
export class CommerceConfigController {
  constructor(private readonly commerceConfigService: CommerceConfigService) {}

  @Post('service-fee-rules')
  @UseGuards(InternalApiTokenGuard)
  createServiceFeeRule(@Body() dto: CreateServiceFeeRuleDto) {
    return this.commerceConfigService.createServiceFeeRule(dto);
  }

  @Get('service-fee-rules')
  @UseGuards(InternalApiTokenGuard)
  findServiceFeeRules() {
    return this.commerceConfigService.findServiceFeeRules();
  }

  @Patch('service-fee-rules/:id/activate')
  @UseGuards(InternalApiTokenGuard)
  activateServiceFeeRule(@Param('id') id: string) {
    return this.commerceConfigService.activateServiceFeeRule(id);
  }

  @Post('coupons')
  @UseGuards(InternalOrJwtGuard)
  createCoupon(@Body() dto: CreateCouponDto) {
    return this.commerceConfigService.createCoupon(dto);
  }

  @Get('coupons')
  @UseGuards(InternalOrJwtGuard)
  findCoupons() {
    return this.commerceConfigService.findCoupons();
  }

  @Patch('coupons/:id/toggle')
  @UseGuards(InternalOrJwtGuard)
  toggleCoupon(@Param('id') id: string) {
    return this.commerceConfigService.toggleCoupon(id);
  }

  @Post('promotions')
  @UseGuards(InternalOrJwtGuard)
  createPromotion(@Body() dto: CreatePromotionDto) {
    return this.commerceConfigService.createPromotion(dto);
  }

  @Get('promotions')
  @UseGuards(InternalOrJwtGuard)
  findPromotions() {
    return this.commerceConfigService.findPromotions();
  }

  @Patch('promotions/:id/toggle')
  @UseGuards(InternalOrJwtGuard)
  togglePromotion(@Param('id') id: string) {
    return this.commerceConfigService.togglePromotion(id);
  }
}
