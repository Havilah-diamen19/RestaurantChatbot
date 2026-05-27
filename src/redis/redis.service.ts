import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

export enum ChatState {
  HOME = 'HOME',
  ORDERING = 'ORDERING',
  CHECKOUT = 'CHECKOUT',
}

export interface SessionState {
  state: ChatState;
  updatedAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.client = createClient({
      socket: {
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
      },
      password: this.config.get<string>('REDIS_PASSWORD') || undefined,
    });

    this.client.on('error', (err) =>
      this.logger.error('Redis error', err),
    );

    await this.client.connect();

    this.logger.log('✅ Redis connected');
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  // ── Chat State Machine ────────────────────────────────────────────────────

  private stateKey(deviceId: string) {
    return `chat:state:${deviceId}`;
  }

  /** Gets the current chatbot FSM state for a device. Defaults to HOME. */
  async getChatState(deviceId: string): Promise<ChatState> {
    const raw = await this.client.get(this.stateKey(deviceId));

    if (!raw || typeof raw !== 'string') {
      return ChatState.HOME;
    }

    try {
      const parsed: SessionState = JSON.parse(raw);
      return parsed.state;
    } catch {
      return ChatState.HOME;
    }
  }

  /** Persists the chatbot FSM state for a device (TTL: 2 hours). */
  async setChatState(
    deviceId: string,
    state: ChatState,
  ): Promise<void> {
    const payload: SessionState = {
      state,
      updatedAt: Date.now(),
    };

    await this.client.set(
      this.stateKey(deviceId),
      JSON.stringify(payload),
      {
        EX: 60 * 60 * 2,
      },
    );
  }

  /** Resets the chat state to HOME */
  async resetChatState(deviceId: string): Promise<void> {
    await this.setChatState(deviceId, ChatState.HOME);
  }

  // ── Generic Cache ─────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);

    if (typeof raw !== 'string') {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds = 300,
  ): Promise<void> {
    await this.client.set(
      key,
      JSON.stringify(value),
      {
        EX: ttlSeconds,
      },
    );
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}