import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AnnouncementsService } from './announcements.service';

@Injectable()
export class AnnouncementDispatchService {
  private readonly logger = new Logger(AnnouncementDispatchService.name);
  private running = false;

  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCron() {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      await this.announcementsService.runDispatchCycle();
    } catch (error) {
      this.logger.error('Announcement dispatch cycle failed', error);
    } finally {
      this.running = false;
    }
  }
}
