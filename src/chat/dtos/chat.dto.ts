import { IsString, IsNotEmpty, MaxLength, IsOptional, IsBoolean, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: '1', description: 'User input — a command number or keyword' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  message: string;
}

export class ScheduleOrderDto {
  @ApiProperty({ example: '2025-12-25T13:00:00.000Z' })
  @IsISO8601()
  scheduledFor: string;

  @ApiPropertyOptional({ example: 'Christmas dinner 🎄' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scheduleNote?: string;
}

export class InitiatePaymentDto {
  @ApiPropertyOptional({ example: 'customer@email.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  scheduled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  scheduledFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  scheduleNote?: string;
}

// ── Bot response message shapes (for Swagger docs) ──────────────────────────

export class BotMessage {
  @ApiProperty({ enum: ['greeting','menu','menu_list','item_added','checkout','current_order','order_history','success','error','info'] })
  type: string;

  @ApiProperty()
  text: string;
}

export class ChatResponse {
  @ApiProperty({ type: [BotMessage] })
  messages: BotMessage[];

  @ApiProperty({ enum: ['HOME', 'ORDERING', 'CHECKOUT'] })
  state: string;
}