import {
  Injectable, Logger, BadRequestException,
  NotFoundException, InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { Order } from '../order/entities/order.entity';
import { OrdersService } from '../order/order.service';
import { SessionService } from '../session/session.service';
import { InitiatePaymentDto } from '../chat/dtos/chat.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { RedisService } from '../redis/redis.service';
import { OrderStatus } from '../order/order-enum';

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly secret: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly ordersService: OrdersService,
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
    // Lazy to avoid circular dep — injected via forwardRef in module
    private chatGateway: ChatGateway,
  ) {
    this.secret = this.config.getOrThrow('PAYSTACK_SECRET_KEY');
  }

  setChatGateway(gw: ChatGateway) { this.chatGateway = gw; }

  // ── Initiate ──────────────────────────────────────────────────────────────

  async initiate(deviceId: string, dto: InitiatePaymentDto) {
    const session = await this.sessionService.getOrCreate(deviceId);
    const cartItems = await this.ordersService.getCart(session);

    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty. Add items before paying.');
    }

    const email = dto.email || `guest_${deviceId.slice(0, 8)}@chopchat.ng`;

    // Validate scheduled date if applicable
    if (dto.scheduled) {
      const schedDate = new Date(dto.scheduledFor!);
      if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
        throw new BadRequestException('scheduledFor must be a valid future date.');
      }
    }

    // Create DB order (snapshot cart)
    const order = await this.ordersService.createOrderFromCart(session, {
      scheduled: dto.scheduled ?? false,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
      scheduleNote: dto.scheduleNote,
    });

    // Scheduled orders skip payment flow
    if (dto.scheduled) {
      await this.ordersService.clearCart(session);
      return {
        success: true,
        scheduled: true,
        order: {
          id: order.id,
          status: order.status,
          totalFormatted: naira(order.totalKobo),
          scheduledFor: order.scheduledFor,
          scheduleNote: order.scheduleNote,
        },
      };
    }

    // Call Paystack
    try {
      const res = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: order.totalKobo,
          currency: 'NGN',
          reference: order.id,
          callback_url: `${this.config.get('FRONTEND_URL')}/payment-callback.html`,
          metadata: {
            order_id: order.id,
            device_id: deviceId,
            items: cartItems.map((i) => `${i.menuItem.emoji} ${i.menuItem.name} ×${i.quantity}`).join(', '),
          },
        },
        { headers: { Authorization: `Bearer ${this.secret}` } },
      );

      const { authorization_url, reference, access_code } = res.data.data;

      await this.orderRepo.update(order.id, { paystackRef: reference });

      return {
        success: true,
        paymentUrl: authorization_url,
        reference,
        accessCode: access_code,
        order: { id: order.id, totalFormatted: naira(order.totalKobo) },
      };
    } catch (err: any) {
      // Roll back: cancel the order we just created
      await this.orderRepo.update(order.id, { status: OrderStatus.CANCELLED });
      this.logger.error('Paystack initiate failed', err?.response?.data);
      throw new InternalServerErrorException('Payment gateway error. Please try again.');
    }
  }

  // ── Verify ────────────────────────────────────────────────────────────────

  async verify(reference: string) {
    try {
      const res = await axios.get(`${this.baseUrl}/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${this.secret}` },
      });

      const { status, amount, metadata } = res.data.data;

      if (status !== 'success') {
        return { success: false, status };
      }

      const order = await this.orderRepo.findOne({
        where: { paystackRef: reference },
        relations: { session: true },
      });
      if (!order) throw new NotFoundException('Order not found for this reference.');

      if (order.status !== OrderStatus.PAID) {
        order.status = OrderStatus.PAID;
        await this.orderRepo.save(order);
        await this.ordersService.clearCart(order.session);

        // Push real-time notification via WebSocket
        if (this.chatGateway) {
          this.chatGateway.notifyPaymentSuccess(
            order.session.deviceId,
            order.id,
            naira(order.totalKobo),
          );
        }
      }

      return { success: true, order: { id: order.id, totalFormatted: naira(order.totalKobo) } };
    } catch (err: any) {
      if (err?.response?.status === 404) throw new NotFoundException('Transaction not found on Paystack.');
      throw err;
    }
  }

  // ── Webhook (server-to-server — HMAC verified) ────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    // Step 1: Verify HMAC-SHA512 signature
    const hash = crypto.createHmac('sha512', this.secret).update(rawBody).digest('hex');

    if (hash !== signature) {
      this.logger.warn('⚠️  Webhook signature mismatch — request rejected');
      return { ignored: true };
    }

    const event = JSON.parse(rawBody.toString());
    this.logger.log(`📨 Paystack webhook: ${event.event}`);

    switch (event.event) {
      case 'charge.success':
        await this.onChargeSuccess(event.data);
        break;
      case 'charge.failed':
        await this.onChargeFailed(event.data);
        break;
      case 'refund.processed':
        this.logger.log(`💸 Refund for ref ${event.data.transaction_reference}`);
        break;
      default:
        this.logger.debug(`Unhandled event: ${event.event}`);
    }

    return { received: true };
  }

  private async onChargeSuccess(data: any) {
    const order = await this.orderRepo.findOne({
      where: { paystackRef: data.reference },
      relations: { session: true },
    });
    if (!order || order.status === OrderStatus.PAID) return;

    order.status = OrderStatus.PAID;
    await this.orderRepo.save(order);
    await this.ordersService.clearCart(order.session);

    // Real-time push
    if (this.chatGateway) {
      this.chatGateway.notifyPaymentSuccess(
        order.session.deviceId,
        order.id,
        naira(order.totalKobo),
      );
    }
    this.logger.log(`✅ Order ${order.id.slice(0, 8)} PAID (webhook)`);
  }

  private async onChargeFailed(data: any) {
    await this.orderRepo.update(
      { paystackRef: data.reference },
      { status: OrderStatus.CANCELLED },
    );
    this.logger.log(`❌ Payment failed for ref ${data.reference}`);
  }
}