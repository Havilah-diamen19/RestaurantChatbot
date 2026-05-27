import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { createClient } from 'redis';
import { redisStore } from 'cache-manager-redis-yet';

import { MenuModule } from './menu/menu.module';
import { SessionModule } from './session/session.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { ChatModule } from './chat/chat.module';
import { SeedModule } from './seed/seed.module';

// TypeORM entity imports (registered centrally)
import { MenuItem } from './menu/entities/menu.entity';
import { Session } from './session/entities/session.entity';
import { CartItem } from './order/entities/cart-item.entity';
import { Order } from './order/entities/order.entity';
import { OrderItem } from './order/entities/order-item.entity';

@Module({
  imports: [
    // ── Config (loads .env) ──────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── MySQL via TypeORM ────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASS'),
        database: config.get('DB_NAME'),
        entities: [MenuItem, Session, CartItem, Order, OrderItem],
        synchronize: config.get('NODE_ENV') !== 'production', // use migrations in prod
        logging: config.get('NODE_ENV') === 'development',
        charset: 'utf8mb4',
      }),
    }),

    // ── Redis Cache ──────────────────────────────────────────────────────────
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get('REDIS_HOST'),
            port: config.get<number>('REDIS_PORT'),
          },
          password: config.get('REDIS_PASSWORD'),
          ttl: 60 * 5 * 1000, // default 5-minute TTL (ms)
        }),
      }),
    }),

    // ── Rate Limiting ────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },   // 10 req/sec
      { name: 'long',  ttl: 60000, limit: 100 },  // 100 req/min
    ]),

    // ── Feature Modules ──────────────────────────────────────────────────────
    MenuModule,
    SessionModule,
    OrderModule,
    PaymentModule,
    ChatModule,
    SeedModule,
  ],
})
export class AppModule {}