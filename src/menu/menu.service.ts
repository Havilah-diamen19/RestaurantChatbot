import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MenuItem, MenuCategory } from './entities/menu.entity';

const MENU_CACHE_KEY = 'menu:all';
const MENU_CACHE_TTL = 60 * 10 * 1000; // 10 minutes in ms

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
    @Inject(CACHE_MANAGER)
    private readonly cache: Cache,
  ) {}

  /** Returns all available menu items, cached in Redis. */
  async findAll(category?: MenuCategory): Promise<MenuItem[]> {
    const cacheKey = category ? `menu:cat:${category}` : MENU_CACHE_KEY;

    const cached = await this.cache.get<MenuItem[]>(cacheKey);
    if (cached) return cached;

    const items = await this.menuRepo.find({
      where: { available: true, ...(category && { category }) },
      order: { id: 'ASC' },
    });

    await this.cache.set(cacheKey, items, MENU_CACHE_TTL);
    return items;
  }

  async findOne(id: number): Promise<MenuItem> {
    const item = await this.menuRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Menu item #${id} not found.`);
    return item;
  }

  /** Busts the menu cache (call after admin updates). */
  async bustCache(): Promise<void> {
    await this.cache.del(MENU_CACHE_KEY);
    for (const cat of Object.values(MenuCategory)) {
      await this.cache.del(`menu:cat:${cat}`);
    }
  }
}