import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealthService() {
    return {
      status: 'ok',
      service: 'ojaboy-backend',
      timestamp: new Date().toISOString(),
    };
  }
}
