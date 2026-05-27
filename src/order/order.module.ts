// order.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './order.service';
import { OrdersController } from './order.controller';
import { Order, OrderItem } from './entities/order.entity';
import { CartItem } from './entities/cart-item.entity';
import { SessionModule } from '../session/session.module'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, CartItem]),
    SessionModule, 
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrderModule {}