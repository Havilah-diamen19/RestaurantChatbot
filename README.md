# 🍽️ Chop & Chat — Restaurant Chatbot API

A real-time restaurant ordering chatbot backend built with **NestJS**, **WebSockets**, **MySQL**, and **Redis**. Customers interact via a conversational chat interface to browse the menu, manage a cart, and pay securely through Paystack — all without a traditional UI form.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Modules](#modules)
- [WebSocket Chat Protocol](#websocket-chat-protocol)
- [REST API](#rest-api)
- [Payment Flow](#payment-flow)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)

---

## Overview

Chop & Chat lets customers order food through a chat interface. The bot guides users through a stateful conversation — browsing the menu, adding items to cart, checking out, and receiving real-time payment confirmation — all over a persistent WebSocket connection.

Key capabilities:
- Stateful chat sessions tracked per device via Redis
- Real-time messaging over Socket.IO with typing indicators
- Full cart and order lifecycle management in MySQL
- Paystack payment initiation, verification, and webhook handling
- Scheduled order support (order now, deliver later)
- Rate limiting, input validation, and HMAC-verified webhooks

---

## Architecture

```
Client (Browser / Mobile)
        │
        │  WebSocket (Socket.IO)        HTTP REST
        │  ws://host/chat               http://host/api
        ▼
┌─────────────────────────────────────────────┐
│              NestJS Application              │
│                                             │
│  ChatGateway ──► ChatService                │
│       │               │                     │
│       │         ┌─────┴──────┐              │
│       │         ▼            ▼              │
│       │    MenuService   OrdersService      │
│       │         │            │              │
│       │    SessionService    │              │
│       │         │            │              │
│       └── RedisService ◄─────┘              │
│                                             │
│  PaymentService ──► Paystack API            │
│       └── ChatGateway (real-time notify)    │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
    MySQL            Redis
 (orders, menu,   (chat state,
  sessions)        cache)
```

---

## Modules

### `ChatModule`
The heart of the application. Handles all WebSocket connections and routes user input through a state machine.

**States:** `HOME` → `ORDERING` → `CHECKOUT`

**Global commands (work from any state):**

| Input | Action |
|-------|--------|
| `1` | Show menu / start ordering |
| `99` | Checkout |
| `98` | Order history |
| `97` | View current cart |
| `0` | Cancel order |
| `menu` / `start` / `home` | Return to main menu |

**ChatGateway** manages Socket.IO lifecycle — on connect, it greets returning users with their order count and cart status, or welcomes new users with the main menu.

---

### `SessionModule`
Identifies customers by `deviceId` (passed as a WebSocket query param). Creates a persistent session record in MySQL on first connect. No login required — device-based identity.

---

### `OrderModule`
Manages the full cart and order lifecycle:
- Add items to cart (persisted in MySQL)
- View and update cart
- Create an order snapshot at checkout
- Track order status: `PENDING` → `PAID` → `CANCELLED`
- Support for scheduled orders (future delivery)
- Order history per session

---

### `MenuModule`
Manages restaurant menu items with categories, pricing (stored in kobo), availability flags, emoji, tags, and descriptions. All prices are displayed in Naira (₦) converted from kobo at render time.

---

### `PaymentModule`
Integrates with **Paystack** for Nigerian payment processing:
- **Initiate** — creates a DB order snapshot, calls Paystack to get a payment URL
- **Verify** — polls Paystack to confirm payment status
- **Webhook** — receives server-to-server `charge.success` / `charge.failed` events, verified via HMAC-SHA512 signature
- On payment confirmation, pushes a real-time `bot_message` to the customer's WebSocket connection

---

### `RedisModule`
Stores ephemeral chat state (`HOME`, `ORDERING`, `CHECKOUT`) per device. Also powers the global response cache (`CacheModule`) with a 5-minute TTL.

---

### `SeedModule`
Populates the database with initial menu data for development and testing.

---

## WebSocket Chat Protocol

**Connection:**
```
ws://localhost:5000/chat?deviceId=<your-device-id>
```
`deviceId` must be at least 4 characters. The server disconnects clients that omit it.

**Client → Server events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `{ message: string }` | Send a chat message |

**Server → Client events:**

| Event | Payload | Description |
|-------|---------|-------------|
| `bot_message` | `{ messages: BotMsg[], state: string }` | Bot response |
| `typing` | `true / false` | Typing indicator |
| `error` | `{ message: string }` | Connection or handler error |

**BotMsg types:** `greeting`, `main_menu`, `menu_list`, `item_added`, `checkout`, `current_order`, `order_history`, `payment_success`, `info`, `error`

---

## REST API

Base URL: `http://localhost:5000/api`

Swagger docs available at: `http://localhost:5000/docs`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/menu` | List all menu items |
| `POST` | `/api/payments/initiate` | Initiate Paystack payment |
| `GET` | `/api/payments/verify/:reference` | Verify payment status |
| `POST` | `/api/payments/webhook` | Paystack webhook receiver |
| `GET` | `/api/orders` | List orders for a session |

All protected routes use the `X-Device-ID` header for session identification.

**Rate limits:**
- 10 requests/second (short window)
- 100 requests/minute (long window)

---

## Payment Flow

```
1. Customer types "99" (checkout) in chat
2. Frontend calls POST /api/payments/initiate with { email, deviceId }
3. Server snapshots cart → creates Order record → calls Paystack
4. Paystack returns { paymentUrl, reference }
5. Customer is redirected to Paystack checkout page
6. On success, Paystack sends webhook to POST /api/payments/webhook
7. Server verifies HMAC signature → marks order PAID → clears cart
8. Server pushes real-time payment_success message via WebSocket
9. Customer sees confirmation in chat instantly
```

Scheduled orders skip the payment step and are saved with `status: SCHEDULED`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript 5 |
| WebSockets | Socket.IO 4 + `@nestjs/platform-socket.io` |
| Database | MySQL 8 via TypeORM |
| Cache / State | Redis 5 via `cache-manager-redis-yet` |
| Payments | Paystack (Nigerian payment gateway) |
| Validation | `class-validator` + `class-transformer` |
| Security | Helmet, CORS, ThrottlerModule, HMAC webhook verification |
| API Docs | Swagger (`@nestjs/swagger`) |
| Runtime | Node.js |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=yourpassword
DB_NAME=restaurant_chatbot

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx

# App
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## Getting Started

**Prerequisites:** Node.js 18+, MySQL 8, Redis

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in your .env values

# 3. Create the database
mysql -u root -p -e "CREATE DATABASE restaurant_chatbot;"

# 4. Start Redis
sudo systemctl start redis-server

# 5. Start the server (dev mode with hot reload)
npm run start:dev
```

**Endpoints will be available at:**
- API → `http://localhost:5000/api`
- Swagger → `http://localhost:5000/docs`
- WebSocket → `ws://localhost:5000/chat`

**Seed the menu (first run):**

The `SeedModule` auto-populates menu data on startup in development mode.

---

## Project Structure

```
src/
├── app.module.ts           # Root module — wires everything together
├── main.ts                 # Bootstrap: CORS, Helmet, Swagger, global pipes
│
├── chat/
│   ├── chat.gateway.ts     # WebSocket gateway — connection lifecycle & events
│   ├── chat.service.ts     # State machine — routes input to correct handler
│   ├── chat.controller.ts  # REST fallback endpoints
│   └── dtos/chat.dto.ts    # Request validation DTOs
│
├── session/
│   ├── session.service.ts  # Device-based session creation & lookup
│   └── entities/
│       └── session.entity.ts
│
├── menu/
│   ├── menu.service.ts     # Menu CRUD
│   ├── menu.controller.ts
│   └── entities/
│       ├── menu.entity.ts
│       └── menu-category.entity.ts
│
├── order/
│   ├── order.service.ts    # Cart management, order creation, history
│   ├── order.controller.ts
│   ├── order-enum.ts       # OrderStatus enum
│   └── entities/
│       ├── order.entity.ts
│       ├── order-item.entity.ts
│       └── cart-item.entity.ts
│
├── payment/
│   ├── payment.service.ts  # Paystack initiate, verify, webhook
│   └── payment.controller.ts
│
├── redis/
│   └── redis.service.ts    # Chat state get/set per deviceId
│
├── seed/
│   └── seed.service.ts     # Dev data seeder
│
└── libs/
    ├── device-id.decorator.ts    # @DeviceId() param decorator
    └── http.exception.filter.ts  # Global error formatter
```

---

## Notes for Production

- Set `NODE_ENV=production` — disables TypeORM `synchronize` (use migrations instead)
- Use a strong `REDIS_PASSWORD`
- Point `FRONTEND_URL` to your actual frontend domain for CORS
- Expose the webhook endpoint (`/api/payments/webhook`) publicly for Paystack to reach it
- Use a process manager like PM2: `pm2 start dist/main.js`