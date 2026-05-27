import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Session } from '../../session/entities/session.entity';
import { MenuItem } from '../../menu/entities/menu.entity';

import { OrderStatus } from '../order-enum';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Session, (s) => s.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @OneToMany(() => OrderItem, (i) => i.order, { cascade: true, eager: true })
  items: OrderItem[];

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PLACED })
  status: OrderStatus;

  /** Total in kobo (subtotal + delivery) */
  @Column({ type: 'int', unsigned: true })
  totalKobo: number;

  @Column({ type: 'int', unsigned: true, default: 50000 }) // ₦500
  deliveryFee: number;

  @Column({ nullable: true, unique: true, length: 100 })
  paystackRef: string;

  @Column({ default: false })
  scheduled: boolean;

  @Column({ type: 'datetime', nullable: true })
  scheduledFor: Date;

  @Column({ nullable: true, length: 200 })
  scheduleNote: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── OrderItem ────────────────────────────────────────────────────────────────

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => MenuItem)
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem;

  @Column()
  quantity: number;

  /** Price snapshot at time of order — immune to future price changes */
  @Column({ type: 'int', unsigned: true })
  unitPrice: number;

  /** Name snapshot */
  @Column({ length: 120 })
  name: string;

  @Column({ length: 10 })
  emoji: string;
}