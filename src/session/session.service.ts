import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  /**
   * Finds an existing session by deviceId or creates a new one.
   * Called on every request that carries X-Device-ID.
   */
  async getOrCreate(deviceId: string): Promise<Session> {
    if (!deviceId || deviceId.trim().length < 4) {
      throw new BadRequestException(
        'X-Device-ID header is required (min 4 chars). ' +
        'Generate with crypto.randomUUID() on the client and persist in localStorage.',
      );
    }

    const id = deviceId.trim().slice(0, 64);

    let session = await this.sessionRepo.findOne({ where: { deviceId: id } });

    if (!session) {
      session = this.sessionRepo.create({ deviceId: id });
      session = await this.sessionRepo.save(session);
    }

    return session;
  }
}