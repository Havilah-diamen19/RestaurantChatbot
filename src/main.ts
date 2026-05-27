import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Security ──────────────────────────────────────────────────────────────
  app.use(helmet.default());
  app.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Device-ID', 'Authorization'],
    credentials:false,
  });

  // ── Global Validation ─────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  // ── Swagger ───────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Chop & Chat Restaurant API')
    .setDescription(
      `REST + WebSocket API powering the Chop & Chat restaurant chatbot.\n\n` +
      `**Authentication:** Pass \`X-Device-ID\` header on all protected routes.\n\n` +
      `**WebSocket:** Connect to \`ws://host/chat\` with \`{ deviceId }\` in handshake query.`,
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'X-Device-ID', in: 'header' }, 'device-id')
    .addTag('chat', 'Chatbot WebSocket gateway + REST fallback')
    .addTag('menu', 'Restaurant menu items')
    .addTag('orders', 'Cart and order management')
    .addTag('payments', 'Paystack payment processing')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT || 5000;
  await app.listen(port);

  console.log(`🚀 Chop & Chat API     → http://localhost:${port}/api`);
  console.log(`📖 Swagger docs        → http://localhost:${port}/docs`);
  console.log(`🔌 WebSocket gateway   → ws://localhost:${port}/chat`);
}

bootstrap();