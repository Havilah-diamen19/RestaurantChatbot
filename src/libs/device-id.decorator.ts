import {
  createParamDecorator, ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

/** Extracts and validates the X-Device-ID header. */
export const DeviceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const id = request.headers['x-device-id'];

    if (!id || typeof id !== 'string' || id.trim().length < 4) {
      throw new BadRequestException(
        'X-Device-ID header is required (min 4 chars). ' +
        'Generate with crypto.randomUUID() and persist in localStorage.',
      );
    }

    return id.trim().slice(0, 64);
  },
);