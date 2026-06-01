import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health-service', () => {
    it('should return service health status', () => {
      expect(appController.getHealthService()).toMatchObject({
        status: 'ok',
        service: 'ojaboy-backend',
      });
    });
  });
});
