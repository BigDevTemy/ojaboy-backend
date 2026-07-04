import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { OrdersService } from './src/orders/orders.service';
import { PrismaService } from './src/prisma/prisma.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const orders = app.get(OrdersService);
  const prisma = app.get(PrismaService);

  const user = await prisma.user.findFirst({ select: { id: true, email: true, fullName: true, role: true } });
  console.log('test user:', user);

  const address = user ? await prisma.userAddress.findFirst({ where: { userId: user.id } }) : null;
  console.log('has address:', !!address);

  const product = await prisma.product.findFirst({ where: { status: 'active' }, select: { id: true, name: true } });
  console.log('sample active product:', product);

  const authUser = user
    ? { id: user.id, email: user.email, fullName: user.fullName ?? 'Test', role: user.role, authProviders: ['password'], emailVerified: true }
    : undefined;

  try {
    const result = await orders.quote(
      { orderText: '1 bag beans' } as never,
      authUser as never,
    );
    console.log('SUCCESS (orderText):', JSON.stringify(result, null, 2).slice(0, 2000));
  } catch (error) {
    console.error('FAILED (orderText):', error);
  }

  await app.close();
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
