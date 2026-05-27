import {
  ExceptionFilter, Catch, ArgumentsHost,
  HttpException, HttpStatus, Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx  = host.switchToHttp();
    const req  = ctx.getRequest<Request>();
    const res  = ctx.getResponse<Response>();

    let status  = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b['message'] as string | string[]) || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const body = {
      statusCode: status,
      error: HttpStatus[status] ?? 'ERROR',
      message,
      path: req.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(`[${status}] ${req.method} ${req.url}`, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(`[${status}] ${req.method} ${req.url}`);
    }

    res.status(status).json(body);
  }
}