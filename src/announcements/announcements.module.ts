import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AnnouncementDispatchService } from './announcement-dispatch.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService, AnnouncementDispatchService],
})
export class AnnouncementsModule {}
