import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

type ThrottledRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
  method?: string;
  originalUrl?: string;
};

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ClientIpThrottlerGuard.name);

  protected async getTracker(request: ThrottledRequest): Promise<string> {
    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedAddresses = (
      Array.isArray(forwardedFor)
        ? forwardedFor.join(',')
        : (forwardedFor ?? '')
    )
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean);

    // Cloud Run appends the load-balancer address after the client address.
    if (forwardedAddresses.length >= 2) {
      return forwardedAddresses[forwardedAddresses.length - 2];
    }

    return (
      forwardedAddresses[0] ??
      request.ip ??
      request.socket?.remoteAddress ??
      'unknown'
    );
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<ThrottledRequest>();

    this.logger.warn({
      message: 'Request rate limit exceeded',
      method: request.method,
      path: request.originalUrl,
      tracker: detail.tracker,
      totalHits: detail.totalHits,
      limit: detail.limit,
      timeToBlockExpire: detail.timeToBlockExpire,
    });

    return super.throwThrottlingException(context, detail);
  }
}
