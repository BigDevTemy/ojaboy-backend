import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { InternalApiTokenGuard } from '../common/guards/internal-api-token.guard';
import { BulkUpdateOrderStatusDto } from './dto/bulk-update-order-status.dto';
import { CreateOrderFeedbackDto } from './dto/create-order-feedback.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { OrderPaginationQueryDto } from './dto/order-pagination-query.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { ResolveQuoteChoiceDto } from './dto/resolve-quote-choice.dto';
import { RetryOrderPaymentDto } from './dto/retry-order-payment.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(@Query() query: OrderListQueryDto) {
    return this.ordersService.findAll(query);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  getStats(@CurrentUser() user: AuthUser) {
    return this.ordersService.getUserOrderStats(user.id);
  }

  @Get('current')
  @UseGuards(JwtAuthGuard)
  getCurrentOrders(@CurrentUser() user: AuthUser) {
    return this.ordersService.getCurrentOrders(user.id);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  getMyOrders(
    @CurrentUser() user: AuthUser,
    @Query() pagination: OrderPaginationQueryDto,
  ) {
    return this.ordersService.getUserOrders(user.id, pagination);
  }

  @Get('mine/:orderId')
  @UseGuards(JwtAuthGuard)
  getMyOrder(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.ordersService.getUserOrder(user.id, orderId);
  }

  @Get('user/:email/:orderId')
  @UseGuards(InternalApiTokenGuard)
  findUserOrderByEmailAndOrderId(
    @Param('email') email: string,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.findUserOrderByEmailAndOrderId(email, orderId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  getOrdersForUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query() pagination: OrderPaginationQueryDto,
  ) {
    return this.ordersService.getUserOrdersAsAdmin(user, userId, pagination);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportOrders(
    @CurrentUser() user: AuthUser,
    @Query() query: OrderListQueryDto,
    @Res() response: Response,
  ) {
    const exportFile = await this.ordersService.exportOrders(user, query);

    response.setHeader('Content-Type', exportFile.contentType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportFile.filename}"`,
    );
    response.send(exportFile.buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.findOneForUser(user, id);
  }

  @Patch('bulk/status')
  @UseGuards(JwtAuthGuard)
  bulkUpdateStatus(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkUpdateOrderStatusDto,
  ) {
    return this.ordersService.bulkUpdateStatus(user, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user, id, dto);
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.ordersService.create(createOrderDto, user);
  }

  @Post('quote')
  @UseGuards(OptionalJwtAuthGuard)
  quote(@Body() quoteOrderDto: QuoteOrderDto, @CurrentUser() user?: AuthUser) {
    return this.ordersService.quote(quoteOrderDto, user);
  }

  // Resolves one needs_confirmation line from /orders/quote after the
  // customer picks a choice, without resubmitting the whole orderText.
  @Post('quote/resolve-item')
  resolveQuoteItem(@Body() dto: ResolveQuoteChoiceDto) {
    return this.ordersService.resolveQuoteItem(dto);
  }

  @Post(':orderId/feedback')
  @UseGuards(JwtAuthGuard)
  createFeedback(
    @CurrentUser() user: AuthUser,
    @Param('orderId') orderId: string,
    @Body() dto: CreateOrderFeedbackDto,
  ) {
    return this.ordersService.createFeedback(user.id, orderId, dto);
  }

  @Post(':orderId/payment/retry')
  retryPayment(
    @Param('orderId') orderId: string,
    @Body() dto: RetryOrderPaymentDto,
  ) {
    return this.ordersService.retryPayment(orderId, dto.email);
  }
}
