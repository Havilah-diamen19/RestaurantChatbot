// src/seed/seed.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItem } from '../menu/entities/menu.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItem]), // ← gives SeedService access to MenuItem repo
  ],
  providers: [SeedService], // ← registers the service so NestJS runs it
})
export class SeedModule {}