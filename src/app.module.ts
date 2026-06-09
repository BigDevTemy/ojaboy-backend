import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AccessControlModule } from './access-control/access-control.module';
import { AgentChatboxModule } from './agent-chatbox/agent-chatbox.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { LogisticsModule } from './logistics/logistics.module';
import { MarketPricesModule } from './market-prices/market-prices.module';
import { MarketsModule } from './markets/markets.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PricesModule } from './prices/prices.module';
import { ProductsModule } from './products/products.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        genReqId: (request) =>
          request.headers['x-request-id']?.toString() ?? randomUUID(),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
        customProps: (request) => ({
          requestId: request.id,
          userAgent: request.headers['user-agent'],
          ip: request.socket.remoteAddress,
        }),
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env.RATE_LIMIT_TTL_MS ?? 60000),
        limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
      },
    ]),
    PrismaModule,
    AuthModule,
    AgentChatboxModule,
    OrdersModule,
    MarketsModule,
    LogisticsModule,
    MarketPricesModule,
    ProductsModule,
    PricesModule,
    PaymentsModule,
    UsersModule,
    AccessControlModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
