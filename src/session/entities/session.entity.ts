import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { CartItem } from '../../order/entities/cart-item.entity';
import { Order } from '../../order/entities/order.entity';

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 64 })
  deviceId: string;

  @OneToMany(() => CartItem, (c) => c.session, { cascade: true })
  cartItems: CartItem[];

  @OneToMany(() => Order, (o) => o.session)
  orders: Order[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}