import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem, MenuCategory } from '../menu/entities/menu.entity';

const MENU: Partial<MenuItem>[] = [
  {
    id: 1, emoji: '🍛',
    name: 'Jollof Rice + Chicken',
    description: 'Nigerian party jollof with smoky tomato base, scotch bonnet, bay leaves and grilled chicken',
    price: 350_000, category: MenuCategory.MAIN, tags: ['popular'] as any,
  },
  {
    id: 2, emoji: '🥘',
    name: 'Egusi Soup + Pounded Yam',
    description: 'Rich melon seed soup with assorted meats, stockfish and palm oil, served with smooth pounded yam',
    price: 420_000, category: MenuCategory.MAIN, tags: ['popular'] as any,
  },
  {
    id: 3, emoji: '🍲',
    name: 'Catfish Pepper Soup',
    description: 'Hot Banga-style catfish pepper soup with utazi leaves and traditional spices',
    price: 380_000, category: MenuCategory.MAIN, tags: ['spicy'] as any,
  },
  {
    id: 4, emoji: '🥩',
    name: 'Suya Platter',
    description: 'Premium beef suya skewers with sliced onions, fresh tomatoes and homemade yaji spice',
    price: 280_000, category: MenuCategory.MAIN, tags: ['spicy', 'popular'] as any,
  },
  {
    id: 5, emoji: '🍚',
    name: 'Fried Rice + Plantain',
    description: 'Nigerian-style fried rice with mixed vegetables, shrimp and sweet ripe fried plantain',
    price: 320_000, category: MenuCategory.MAIN, tags: [] as any,
  },
  {
    id: 6, emoji: '🫔',
    name: 'Moi Moi (3 wraps)',
    description: 'Steamed bean pudding with boiled egg, fish and blended red peppers',
    price: 150_000, category: MenuCategory.SIDE, tags: ['vegetarian'] as any,
  },
  {
    id: 7, emoji: '🫓',
    name: 'Akara + Pap',
    description: 'Crispy golden bean fritters served with warm sweet ogi (corn pap)',
    price: 120_000, category: MenuCategory.BREAKFAST, tags: ['vegetarian'] as any,
  },
  {
    id: 8, emoji: '🍽️',
    name: 'Ofe Onugbu + Fufu',
    description: 'Bitter leaf soup with pounded cocoyam, smoked fish and assorted beef',
    price: 450_000, category: MenuCategory.MAIN, tags: [] as any,
  },
  {
    id: 9, emoji: '🍹',
    name: 'Chapman (Large)',
    description: 'Classic Nigerian cocktail with Fanta, Sprite, Ribena, sliced cucumber and cherries',
    price: 100_000, category: MenuCategory.DRINK, tags: [] as any,
  },
  {
    id: 10, emoji: '🥤',
    name: 'Zobo Special',
    description: 'Chilled hibiscus flower drink infused with ginger, cloves and pineapple',
    price: 80_000, category: MenuCategory.DRINK, tags: ['vegetarian'] as any,
  },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuRepo: Repository<MenuItem>,
  ) {}

  /** Runs automatically on app start — idempotent (upsert by id). */
  async onApplicationBootstrap() {
    const existing = await this.menuRepo.count();
    if (existing >= MENU.length) {
      this.logger.log(`🌱 Seed skipped — ${existing} menu items already present`);
      return;
    }

    for (const item of MENU) {
      await this.menuRepo
        .createQueryBuilder()
        .insert()
        .into(MenuItem)
        .values(item)
        .orIgnore() // MySQL: INSERT IGNORE — skips if id already exists
        .execute();
    }
    this.logger.log(`🌱 Seeded ${MENU.length} menu items`);
  }
}