import { Controller, Post, Get, Body, Headers } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiSecurity, ApiBody,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SessionService } from '../session/session.service';
import { SendMessageDto, ChatResponse } from './dtos/chat.dto';

@ApiTags('chat')
@ApiSecurity('device-id')
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly sessionService: SessionService,
  ) {}

  @Get('start')
  @ApiOperation({ summary: 'Initialise session and get opening greeting (REST fallback)' })
  @ApiResponse({ status: 200, type: ChatResponse })
  async start(@Headers('x-device-id') deviceId: string) {
    return this.chatService.greet(deviceId);
  }

  @Post('message')
  @ApiOperation({ summary: 'Send a chat message and get bot response (REST fallback)' })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ status: 200, type: ChatResponse })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async message(
    @Headers('x-device-id') deviceId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.handle(deviceId, dto.message);
  }
}