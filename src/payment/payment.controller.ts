import {
  Controller, Post, Get, Body, Param,
  Headers, HttpCode, Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags, ApiOperation, ApiResponse,
  ApiSecurity, ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payment.service';
import { InitiatePaymentDto } from '../chat/dtos/chat.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @ApiSecurity('device-id')
  @ApiOperation({ summary: 'Create order and get Paystack payment URL' })
  @ApiResponse({ status: 201, description: 'Returns Paystack authorization_url' })
  initiate(
    @Headers('x-device-id') deviceId: string,
    @Body() dto: InitiatePaymentDto,
  ) {
    return this.paymentsService.initiate(deviceId, dto);
  }

  @Get('verify/:reference')
  @ApiSecurity('device-id')
  @ApiOperation({ summary: 'Verify payment after Paystack redirect' })
  @ApiParam({ name: 'reference' })
  verify(@Param('reference') reference: string) {
    return this.paymentsService.verify(reference);
  }

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Paystack server-to-server webhook (HMAC-SHA512 verified)' })
  webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody ?? Buffer.alloc(0), signature);
  }
}