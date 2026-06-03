// src/common/guards/internal-api-token.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class InternalApiTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing internal API token');
    }

    const token = authHeader.slice('Bearer '.length);
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Invalid internal API token');
    }

    return true;
  }
}