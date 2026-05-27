import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dtos/chat.dto';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: false
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // ── Connection lifecycle ──────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    const deviceId = client.handshake.query.deviceId as string;

    if (!deviceId || deviceId.trim().length < 4) {
      this.logger.warn(`Client ${client.id} rejected — no deviceId`);
      client.emit('error', { message: 'deviceId query param is required.' });
      client.disconnect();
      return;
    }

    // Store deviceId on socket for use in message handlers
    client.data.deviceId = deviceId.trim().slice(0, 64);
    client.join(`device:${deviceId}`); // room per device

    this.logger.log(`🔌 Connected: ${client.id} (device: ${deviceId.slice(0, 8)}...)`);

    try {
      const result = await this.chatService.greet(client.data.deviceId);
      client.emit('bot_message', result);
    } catch (err) {
      this.logger.error('Greet error', err);
      client.emit('error', { message: 'Failed to start session. Please refresh.' });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Disconnected: ${client.id}`);
  }

  // ── Message handler ───────────────────────────────────────────────────────

  @SubscribeMessage('message')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleMessage(
    @MessageBody() dto: SendMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    const deviceId: string = client.data.deviceId;

    if (!deviceId) {
      client.emit('error', { message: 'Session not initialised. Reconnect.' });
      return;
    }

    try {
      // Emit typing indicator to the sender
      client.emit('typing', true);

      // Small artificial delay so the UI can show the typing indicator
      await new Promise((r) => setTimeout(r, 350));

      const result = await this.chatService.handle(deviceId, dto.message);

      client.emit('typing', false);
      client.emit('bot_message', result);
    } catch (err) {
      client.emit('typing', false);
      this.logger.error(`Message handler error [${deviceId}]`, err);
      client.emit('bot_message', {
        messages: [{ type: 'error', text: '⚠️ Something went wrong. Please try again.' }],
        state: 'HOME',
      });
    }
  }

  // ── Broadcast utility (used by PaymentsService after webhook) ────────────

  /** Push a payment-confirmed message to a specific device. */
  notifyPaymentSuccess(deviceId: string, orderId: string, totalFormatted: string) {
    this.server.to(`device:${deviceId}`).emit('bot_message', {
      messages: [
        {
          type: 'payment_success',
          text: `🎉 Payment confirmed! Order #${orderId.slice(0, 8).toUpperCase()} is being prepared.`,
          payload: { orderId, totalFormatted },
        },
        {
          type: 'main_menu',
          text: 'What\'s next?',
          payload: {
            options: [
              { label: '🍽️ Order again', value: '1' },
              { label: '📋 View history', value: '98' },
            ],
          },
        },
      ],
      state: 'HOME',
    });
  }
}