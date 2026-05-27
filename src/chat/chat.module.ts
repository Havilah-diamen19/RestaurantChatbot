import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { RedisModule } from '../redis/redis.module';
import { SessionModule } from '../session/session.module';
import { OrderModule } from '../order/order.module';
import { MenuModule } from '../menu/menu.module';
import { ChatGateway } from './chat.gateway';


@Module({
  imports: [RedisModule, SessionModule, OrderModule, MenuModule],
  controllers:[ChatController],
  exports:[ChatService],
  providers:[ChatService, ChatGateway],
})
export class ChatModule {}
