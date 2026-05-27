import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Unique, CreateDateColumn,
} from 'typeorm';
import { Session } from '../../session/entities/session.entity';
import { MenuItem } from '../../menu/entities/menu.entity';

@Entity('cart_items')
@Unique(['session', 'menuItem']) // one row per item per session
export class CartItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Session, (s) => s.cartItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @ManyToOne(() => MenuItem, { eager: true })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;

  @Column({ default: 1, unsigned: true })
  quantity: number;

  @CreateDateColumn()
  addedAt: Date;
}