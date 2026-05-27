import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum MenuCategory {
  MAIN      = 'main',
  SIDE      = 'side',
  DRINK     = 'drink',
  BREAKFAST = 'breakfast',
}

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  /** Price in kobo (₦1 = 100 kobo) — integer avoids float issues */
  @Column({ type: 'int', unsigned: true })
  price: number;

  @Column({ length: 10 })
  emoji: string;

  @Column({ type: 'enum', enum: MenuCategory, default: MenuCategory.MAIN })
  category: MenuCategory;

  /** Stored as JSON string: e.g. '["popular","spicy"]' */
  @Column({ type: 'json', nullable:false })
  tags: string[];

  @Column({ default: true })
  available: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}