import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, In } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { Order} from './entities/order.entity';
import { OrderItem } from './entities/order.entity';
import { Session } from '../session/entities/session.entity';
import { MenuItem } from '../menu/entities/menu.entity';
import { OrderStatus } from './order-enum';

const DELIVERY_FEE = 50_000;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    private readonly dataSource: DataSource,
  ) {}

  async getCart(session: Session): Promise<CartItem[]> {
    return this.cartRepo.find({
      where: { session: { id: session.id } },
      order: { addedAt: 'ASC' },
    });
  }

  async getCartCount(session: Session): Promise<number> {
    const items = await this.getCart(session);
    return items.reduce((sum, i) => sum + i.quantity, 0);
  }

  async addToCart(session: Session, menuItem: MenuItem): Promise<CartItem> {
    let cartItem = await this.cartRepo.findOne({
      where: { session: { id: session.id }, menuItem: { id: menuItem.id } },
    });
    if (cartItem) {
      cartItem.quantity += 1;
      return this.cartRepo.save(cartItem);
    }
    cartItem = this.cartRepo.create({ session, menuItem, quantity: 1 });
    return this.cartRepo.save(cartItem);
  }

  async removeFromCart(session: Session, menuItemId: number): Promise<void> {
    await this.cartRepo.delete({ session: { id: session.id }, menuItem: { id: menuItemId } });
  }

  async clearCart(session: Session): Promise<void> {
    await this.cartRepo.delete({ session: { id: session.id } });
  }

  async createOrderFromCart(
    session: Session,
    opts: { scheduled?: boolean; scheduledFor?: Date; scheduleNote?: string } = {},
  ): Promise<Order> {
    const cartItems = await this.getCart(session);
    if (cartItems.length === 0) {
      throw new BadRequestException('Cart is empty. Add items before checking out.');
    }

    const subtotal = cartItems.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0);
    const totalKobo = subtotal + DELIVERY_FEE;

    return this.dataSource.transaction(async (em) => {
      // Create order
      const order = new Order();
      order.session = session;
      order.totalKobo = totalKobo;
      order.deliveryFee = DELIVERY_FEE;
      order.status = opts.scheduled ? OrderStatus.SCHEDULED : OrderStatus.PLACED;
      order.scheduled = opts.scheduled ?? false;
      order.scheduledFor = opts.scheduledFor as Date;
      order.scheduleNote = opts.scheduleNote as string;
      order.items = [];

      const savedOrder = await em.save(Order, order);

      // Create order items
      for (const ci of cartItems) {
        const item = new OrderItem();
        item.order = savedOrder;
        item.menuItem = ci.menuItem;
        item.quantity = ci.quantity;
        item.unitPrice = ci.menuItem.price;
        item.name = ci.menuItem.name;
        item.emoji = ci.menuItem.emoji;
        await em.save(OrderItem, item);
      }

      return em.findOne(Order, { where: { id: savedOrder.id } }) as Promise<Order>;
    });
  }

  async getHistory(session: Session): Promise<Order[]> {
    return this.orderRepo.find({
      where: { session: { id: session.id }, status: Not(In([OrderStatus.CANCELLED])) },
      order: { createdAt: 'DESC' },
    });
  }

  async getHistoryCount(session: Session): Promise<number> {
    return this.orderRepo.count({
      where: { session: { id: session.id }, status: Not(In([OrderStatus.CANCELLED])) },
    });
  }

  async findOrderById(orderId: string, session: Session): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, session: { id: session.id } },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return order;
  }

  get deliveryFee() { return DELIVERY_FEE; }
}