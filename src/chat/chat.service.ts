import { Injectable, Logger } from '@nestjs/common';
import { RedisService, ChatState } from '../redis/redis.service';
import { SessionService } from '../session/session.service';
import { OrdersService } from '../order/order.service';
import { MenuService } from '../menu/menu.service';
import { Session } from '../session/entities/session.entity';

const DELIVERY_FEE = 50_000;

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

/** A single bot message pushed to the client */
export interface BotMsg {
  type: string;
  text: string;
  payload?: Record<string, unknown>;
}

export interface ChatResult {
  messages: BotMsg[];
  state: ChatState;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly sessions: SessionService,
    private readonly orders: OrdersService,
    private readonly menu: MenuService,
  ) {}

  // ── Public entry point ────────────────────────────────────────────────────

  async handle(deviceId: string, input: string): Promise<ChatResult> {
    const session = await this.sessions.getOrCreate(deviceId);
    const currentState = await this.redis.getChatState(deviceId);
    const cmd = input.trim().toLowerCase();

    this.logger.debug(`[${deviceId}] state=${currentState} input="${cmd}"`);

    // Global commands work from any state
    switch (cmd) {
      // case '1':     return this.showMenu(deviceId);
      case '99':    return this.checkout(deviceId, session);
      case '98':    return this.orderHistory(deviceId, session);
      case '97':    return this.currentOrder(deviceId, session);
      case '0':     return this.cancelOrder(deviceId, session);
      case 'menu':
      case 'start':
      case 'home':  return this.mainMenu(deviceId);
    }

    // State-specific routing
    switch (currentState) {
      case ChatState.ORDERING:  return this.handleOrdering(deviceId, session, cmd, input);
      case ChatState.HOME:      return this.handleHome(deviceId, cmd);  // ← new
      default:                  return this.handleUnknown(deviceId, input);
    }
  }

  private async handleHome(deviceId: string, cmd: string): Promise<ChatResult> {
  switch (cmd) {
    case '1': return this.showMenu(deviceId);  // ← "1" only works at HOME
    default:  return this.handleUnknown(deviceId, cmd);
  }
}

  /** Called on first connect — returns greeting + main menu */
  async greet(deviceId: string): Promise<ChatResult> {
    const session = await this.sessions.getOrCreate(deviceId);
    const orderCount = await this.orders.getHistoryCount(session);
    const cartCount  = await this.orders.getCartCount(session);
    await this.redis.setChatState(deviceId, ChatState.HOME);

    const greeting = orderCount > 0
      ? `Welcome back! 👋  You have ${orderCount} past order${orderCount !== 1 ? 's' : ''}.` +
        (cartCount > 0 ? ` You still have ${cartCount} item(s) in your cart!` : '')
      : `Welcome to *Chop & Chat* 🍽️\nNigeria's favourite restaurant — now in your pocket.`;

    const { messages } = await this.mainMenu(deviceId);
    return {
      messages: [{ type: 'greeting', text: greeting }, ...messages],
      state: ChatState.HOME,
    };
  }

  // ── State handlers ────────────────────────────────────────────────────────

  async mainMenu(deviceId: string): Promise<ChatResult> {
    await this.redis.setChatState(deviceId, ChatState.HOME);
    return {
      messages: [{
        type: 'main_menu',
        text: 'What would you like to do?',
        payload: {
          options: [
            { label: '🍽️  1 · Place an order',   value: '1' },
            { label: '✅  99 · Checkout',          value: '99' },
            { label: '📋  98 · Order history',     value: '98' },
            { label: '🛒  97 · Current order',     value: '97' },
            { label: '❌  0 · Cancel order',       value: '0' },
          ],
        },
      }],
      state: ChatState.HOME,
    };
  }

  async showMenu(deviceId: string): Promise<ChatResult> {
    await this.redis.setChatState(deviceId, ChatState.ORDERING);
    const items = await this.menu.findAll();

     await this.redis.setMenuIndex(deviceId, items.map((i) => i.id));
    return {
      messages: [{
        type: 'menu_list',
        text: '🍴 Here\'s our menu. Type a number to add to cart:',
        payload: {
          items: items.map((item, index) => ({
            position: index + 1,
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            priceFormatted: naira(item.price),
            emoji: item.emoji,
            category: item.category,
            tags: item.tags,
          })),
          footer: 'Type item number to add · Type "done" when finished · "97" to see cart',
        },
      }],
      state: ChatState.ORDERING,
    };
  }

  private async handleOrdering(
  deviceId: string,
  session: Session,
  cmd: string,
  raw: string,
): Promise<ChatResult> {
  if (cmd === 'done' || cmd === 'finish') {
    const items = await this.orders.getCart(session);
    if (items.length === 0) {
      return {
        messages: [{ type: 'error', text: '⚠️ Cart is empty. Add at least one item first.' }],
        state: ChatState.ORDERING,
      };
    }
    return this.checkout(deviceId, session);
  }

  const num = parseInt(cmd, 10);

  // ✅ Fetch real menu length instead of hardcoded 10
  const menuIndex = await this.redis.getMenuIndex(deviceId);
  const menuSize = menuIndex.length || 10; // fallback to 10 if not loaded yet

  if (!isNaN(num) && num >= 1 && num <= menuSize) {
    return this.addItem(deviceId, session, num);
  }

  return {
    messages: [{
      type: 'error',
      text: `❓ "${raw}" isn't a valid item number (1-${menuSize}).\nType "done" to finish or "0" to cancel.`,
    }],
    state: ChatState.ORDERING,
  };
}

 private async addItem(deviceId: string, session: Session, position: number): Promise<ChatResult> {
  // ✅ Resolve position (1-based) → real DB item id
  const menuIndex = await this.redis.getMenuIndex(deviceId);

  if (menuIndex.length === 0) {
    // User never loaded the menu — prompt them to
    return {
      messages: [{
        type: 'error',
        text: '⚠️ Please view the menu first. Type "1" to see it.',
      }],
      state: ChatState.ORDERING,
    };
  }

  const realItemId = menuIndex[position - 1]; // convert 1-based → 0-based index

  if (!realItemId) {
    return {
      messages: [{
        type: 'error',
        text: `⚠️ No item #${position}. Choose 1–${menuIndex.length}.`,
      }],
      state: ChatState.ORDERING,
    };
  }

  // ✅ Now fetch using the real DB id
  let item: Awaited<ReturnType<typeof this.menu.findOne>>;
  try {
    item = await this.menu.findOne(realItemId);
  } catch {
    return {
      messages: [{ type: 'error', text: `⚠️ Item #${position} could not be found. Try again.` }],
      state: ChatState.ORDERING,
    };
  }

  if (!item.available) {
    return {
      messages: [{ type: 'error', text: `😔 ${item.emoji} ${item.name} is unavailable. Pick another!` }],
      state: ChatState.ORDERING,
    };
  }

  const cartItem = await this.orders.addToCart(session, item);
  const cartCount = await this.orders.getCartCount(session);

  return {
    messages: [{
      type: 'item_added',
      text: `✅ ${item.emoji} *${item.name}* added! (${naira(item.price)})`,
      payload: {
        item: {
          name: item.name,
          emoji: item.emoji,
          priceFormatted: naira(item.price),
          quantity: cartItem.quantity,
        },
        cartCount,
        hint: `${cartCount} item(s) in cart · add more or type "done"`,
      },
    }],
    state: ChatState.ORDERING,
  };
}

  async checkout(deviceId: string, session: Session): Promise<ChatResult> {
    const cartItems = await this.orders.getCart(session);

    if (cartItems.length === 0) {
      await this.redis.setChatState(deviceId, ChatState.HOME);
      const { messages } = await this.mainMenu(deviceId);
      return {
        messages: [{ type: 'info', text: '❌ No order to place — cart is empty!' }, ...messages],
        state: ChatState.HOME,
      };
    }

    await this.redis.setChatState(deviceId, ChatState.CHECKOUT);

    const subtotal = cartItems.reduce((s, i) => s + i.menuItem.price * i.quantity, 0);
    const total = subtotal + DELIVERY_FEE;

    return {
      messages: [{
        type: 'checkout',
        text: '🧾 Order Summary',
        payload: {
          items: cartItems.map((i) => ({
            name: i.menuItem.name,
            emoji: i.menuItem.emoji,
            quantity: i.quantity,
            lineTotalFormatted: naira(i.menuItem.price * i.quantity),
          })),
          subtotalFormatted: naira(subtotal),
          deliveryFeeFormatted: naira(DELIVERY_FEE),
          totalFormatted: naira(total),
          totalKobo: total,
          actions: [
            { label: `💳 Pay ${naira(total)} with Paystack`, action: 'PAY_NOW' },
            { label: '📅 Schedule this order', action: 'SCHEDULE' },
            { label: '🏠 Back to menu', action: 'HOME' },
          ],
        },
      }],
      state: ChatState.CHECKOUT,
    };
  }

  async orderHistory(deviceId: string, session: Session): Promise<ChatResult> {
    const orders = await this.orders.getHistory(session);
    await this.redis.setChatState(deviceId, ChatState.HOME);

    if (orders.length === 0) {
      const { messages } = await this.mainMenu(deviceId);
      return {
        messages: [{ type: 'info', text: '📋 No past orders yet. Place your first one!' }, ...messages],
        state: ChatState.HOME,
      };
    }

    return {
      messages: [{
        type: 'order_history',
        text: `📋 Order History (${orders.length} order${orders.length !== 1 ? 's' : ''})`,
        payload: {
          orders: orders.map((o) => ({
            id: o.id,
            status: o.status,
            totalFormatted: naira(o.totalKobo),
            itemSummary: o.items.map((i) => `${i.emoji} ${i.name} ×${i.quantity}`).join(', '),
            scheduled: o.scheduled,
            scheduledFor: o.scheduledFor,
            scheduleNote: o.scheduleNote,
            createdAt: o.createdAt,
          })),
        },
      }],
      state: ChatState.HOME,
    };
  }

  async currentOrder(deviceId: string, session: Session): Promise<ChatResult> {
    const cartItems = await this.orders.getCart(session);
    const currentState = await this.redis.getChatState(deviceId);

    if (cartItems.length === 0) {
      return {
        messages: [
          { type: 'info', text: '🛒 Your cart is empty.' },
          { type: 'main_menu', text: '', payload: { options: [{ label: '🍽️ Place an order', value: '1' }] } },
        ],
        state: currentState,
      };
    }

    const subtotal = cartItems.reduce((s, i) => s + i.menuItem.price * i.quantity, 0);

    return {
      messages: [{
        type: 'current_order',
        text: '🛒 Your Cart',
        payload: {
          items: cartItems.map((i) => ({
            menuItemId: i.menuItem.id,
            name: i.menuItem.name,
            emoji: i.menuItem.emoji,
            quantity: i.quantity,
            lineTotalFormatted: naira(i.menuItem.price * i.quantity),
          })),
          subtotalFormatted: naira(subtotal),
          totalFormatted: naira(subtotal + DELIVERY_FEE),
          options: [
            { label: '✅ 99 · Checkout', value: '99' },
            { label: '🍽️ 1 · Add more', value: '1' },
            { label: '❌ 0 · Cancel', value: '0' },
          ],
        },
      }],
      state: currentState,
    };
  }

  async cancelOrder(deviceId: string, session: Session): Promise<ChatResult> {
    const cartItems = await this.orders.getCart(session);

    if (cartItems.length === 0) {
      const { messages } = await this.mainMenu(deviceId);
      return {
        messages: [{ type: 'info', text: 'ℹ️ No active order to cancel.' }, ...messages],
        state: ChatState.HOME,
      };
    }

    await this.orders.clearCart(session);
    await this.redis.setChatState(deviceId, ChatState.HOME);
    const { messages } = await this.mainMenu(deviceId);

    return {
      messages: [{ type: 'success', text: '✅ Order cancelled.' }, ...messages],
      state: ChatState.HOME,
    };
  }

  private async handleUnknown(deviceId: string, raw: string): Promise<ChatResult> {
    const { messages } = await this.mainMenu(deviceId);
    return {
      messages: [
        { type: 'error', text: `❓ I didn't understand "${raw}". Here's what you can do:` },
        ...messages,
      ],
      state: ChatState.HOME,
    };
  }
}