// src/common/middleware/internal-api-token.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class InternalApiTokenMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing internal API token');
    }

    const token = authHeader.slice('Bearer '.length);
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Invalid internal API token');
    }

    next();
  }
}