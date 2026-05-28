// src/payment/payment.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  HttpCode,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payment.service';
import { InitiatePaymentDto } from '../chat/dtos/chat.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments/initiate
   * Frontend calls this when user clicks "PAY NOW"
   * Returns a Paystack payment URL the frontend opens
   */
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

  /**
   * GET /payments/verify/:reference
   * Frontend calls this after Paystack redirects back
   * Confirms the payment and marks order as PAID
   */
  @Get('verify/:reference')
  @ApiSecurity('device-id')
  @ApiOperation({ summary: 'Verify payment after Paystack redirect' })
  @ApiParam({ name: 'reference', description: 'Paystack transaction reference' })
  verify(@Param('reference') reference: string) {
    return this.paymentsService.verify(reference);
  }

  /**
   * POST /payments/webhook
   * Paystack calls this directly on their servers after payment
   * HMAC-SHA512 signature verified — not for frontend use
   */
  @Post('webhook')
  @HttpCode(200) // Paystack expects 200, not 201
  @ApiOperation({ summary: 'Paystack server-to-server webhook (HMAC-SHA512 verified)' })
  webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-paystack-signature') signature: string,
  ) {
    // rawBody needed for HMAC verification — must be raw bytes, not parsed JSON
    return this.paymentsService.handleWebhook(
      req.rawBody ?? Buffer.alloc(0),
      signature,
    );
  }
}