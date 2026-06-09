import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

function createPrismaAdapter() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(
      process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 10000,
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: Number(
      process.env.DATABASE_KEEP_ALIVE_DELAY_MS ?? 10000,
    ),
    maxLifetimeSeconds: Number(process.env.DATABASE_MAX_LIFETIME_SECONDS ?? 300),
  });

  return new PrismaPg(pool, {
    disposeExternalPool: true,
    onPoolError: (error) => {
      console.error('Prisma PostgreSQL pool error', error);
    },
    onConnectionError: (error) => {
      console.error('Prisma PostgreSQL connection error', error);
    },
  });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: createPrismaAdapter() });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
