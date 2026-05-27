import {
  Controller, Get, Delete, Param, ParseIntPipe,
  Headers, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiSecurity, ApiParam,
} from '@nestjs/swagger';
import { OrdersService } from './order.service';
import { SessionService } from '../session/session.service';

@ApiTags('orders')
@ApiSecurity('device-id')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly sessionService: SessionService,
  ) {}

  @Get('history')
  @ApiOperation({ summary: 'Get full order history for device session' })
  @ApiResponse({ status: 200, description: 'Array of past orders' })
  async getHistory(@Headers('x-device-id') deviceId: string) {
    const session = await this.sessionService.getOrCreate(deviceId);
    return this.ordersService.getHistory(session);
  }

  @Get('cart')
  @ApiOperation({ summary: 'Get current cart contents' })
  @ApiResponse({ status: 200, description: 'Cart items with totals' })
  async getCart(@Headers('x-device-id') deviceId: string) {
    const session = await this.sessionService.getOrCreate(deviceId);
    const items = await this.ordersService.getCart(session);
    const subtotal = items.reduce((s, i) => s + i.menuItem.price * i.quantity, 0);
    return {
      items,
      subtotalKobo: subtotal,
      deliveryFeeKobo: this.ordersService.deliveryFee,
      totalKobo: subtotal + this.ordersService.deliveryFee,
    };
  }

  @Delete('cart')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear entire cart' })
  @ApiResponse({ status: 204, description: 'Cart cleared' })
  async clearCart(@Headers('x-device-id') deviceId: string) {
    const session = await this.sessionService.getOrCreate(deviceId);
    await this.ordersService.clearCart(session);
  }

  @Delete('cart/:menuItemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one item from cart' })
  @ApiParam({ name: 'menuItemId', type: Number })
  async removeItem(
    @Headers('x-device-id') deviceId: string,
    @Param('menuItemId', ParseIntPipe) menuItemId: number,
  ) {
    const session = await this.sessionService.getOrCreate(deviceId);
    await this.ordersService.removeFromCart(session, menuItemId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Order detail' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOne(
    @Headers('x-device-id') deviceId: string,
    @Param('id') id: string,
  ) {
    const session = await this.sessionService.getOrCreate(deviceId);
    return this.ordersService.findOrderById(id, session);
  }
}