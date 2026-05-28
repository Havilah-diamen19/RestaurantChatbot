// src/payment/payment.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payment.service';
import { PaymentsController } from './payment.controller';
import { Order } from '../order/entities/order.entity';
import { OrderModule } from '../order/order.module';
import { SessionModule } from '../session/session.module';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]), // gives PaymentsService access to Order repo
    OrderModule,                       // provides OrdersService
    SessionModule,                     // provides SessionService
    RedisModule,                       // provides RedisService
    // forwardRef(() => ChatModule),      // forwardRef breaks circular dep with ChatModule
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],          // exported so ChatModule can use it
})
export class PaymentModule {}