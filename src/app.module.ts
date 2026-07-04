import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { AccessControlModule } from './access-control/access-control.module';
import { AddressesModule } from './addresses/addresses.module';
import { AgentChatboxModule } from './agent-chatbox/agent-chatbox.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { CommerceConfigModule } from './commerce-config/commerce-config.module';
import { ClientIpThrottlerGuard } from './common/guards/client-ip-throttler.guard';
import { LogisticsModule } from './logistics/logistics.module';
import { MarketPricesModule } from './market-prices/market-prices.module';
import { MarketAnalysisModule } from './market-analysis/market-analysis.module';
import { MarketsModule } from './markets/markets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PriceAlertsModule } from './price-alerts/price-alerts.module';
import { PriceUnitsModule } from './price-units/price-units.module';
import { PricesModule } from './prices/prices.module';
import { ProductsModule } from './products/products.module';
import { ProductCategoriesModule } from './product-categories/product-categories.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { WishlistsModule } from './wishlists/wishlists.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';

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
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CatalogueModule,
    AgentChatboxModule,
    OrdersModule,
    MarketsModule,
    LogisticsModule,
    MarketPricesModule,
    MarketAnalysisModule,
    ProductsModule,
    ProductCategoriesModule,
    PricesModule,
    PaymentsModule,
    PriceAlertsModule,
    PriceUnitsModule,
    NotificationsModule,
    UsersModule,
    AccessControlModule,
    AddressesModule,
    CommerceConfigModule,
    WishlistsModule,
    SupportTicketsModule,
    AnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ClientIpThrottlerGuard,
    },
  ],
})
export class AppModule {}
