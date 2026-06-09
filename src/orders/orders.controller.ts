import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InternalApiTokenGuard } from '../common/guards/internal-api-token.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { QuoteOrderDto } from './dto/quote-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @Get('user/:email/:orderId')
  @UseGuards(InternalApiTokenGuard)
  findUserOrderByEmailAndOrderId(
    @Param('email') email: string,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.findUserOrderByEmailAndOrderId(email, orderId);
  }

  @Get(':id')
  @UseGuards(InternalApiTokenGuard)
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Post('quote')
  quote(@Body() quoteOrderDto: QuoteOrderDto) {
    return this.ordersService.quote(quoteOrderDto);
  }
}
