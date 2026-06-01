import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  findAll() {
    return {
      data: [],
      message: 'Orders endpoint is ready.',
    };
  }

  create(createOrderDto: CreateOrderDto) {
    return {
      message: 'Order received.',
      order: {
        id: randomUUID(),
        ...createOrderDto,
        status: 'pending',
        createdAt: new Date().toISOString(),
      },
    };
  }
}
