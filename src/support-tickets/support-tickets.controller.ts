import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { CreateSupportTicketMessageDto } from './dto/create-support-ticket-message.dto';
import { ReassignSupportTicketDto } from './dto/reassign-support-ticket.dto';
import { SupportTicketQueryDto } from './dto/support-ticket-query.dto';
import { UpdateSupportTicketStatusDto } from './dto/update-support-ticket-status.dto';
import {
  MAX_SUPPORT_ATTACHMENTS,
  supportTicketUploadOptions,
} from './support-ticket-upload';
import { SupportTicketsService } from './support-tickets.service';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class SupportTicketsController {
  constructor(private readonly supportTicketsService: SupportTicketsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor(
      'attachments',
      MAX_SUPPORT_ATTACHMENTS,
      supportTicketUploadOptions,
    ),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSupportTicketDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.supportTicketsService.create(user, dto, files);
  }

  @Get('created')
  findCreatedByMe(
    @CurrentUser() user: AuthUser,
    @Query() query: SupportTicketQueryDto,
  ) {
    return this.supportTicketsService.findMine(user.id, query);
  }

  @Get('assigned')
  findAssignedToMe(
    @CurrentUser() user: AuthUser,
    @Query() query: SupportTicketQueryDto,
  ) {
    return this.supportTicketsService.findAssignedToMe(user, query);
  }

  @Get('summary')
  getMySummary(@CurrentUser() user: AuthUser) {
    return this.supportTicketsService.getMySummary(user.id);
  }

  @Get('admin')
  findAdminTickets(
    @CurrentUser() user: AuthUser,
    @Query() query: SupportTicketQueryDto,
  ) {
    return this.supportTicketsService.findAdminTickets(user, query);
  }

  @Get('admin/staff')
  listSupportStaff(@CurrentUser() user: AuthUser) {
    return this.supportTicketsService.listSupportStaff(user);
  }

  @Get('attachments/:attachmentId/download')
  async downloadAttachment(
    @CurrentUser() user: AuthUser,
    @Param('attachmentId') attachmentId: string,
    @Res() response: Response,
  ) {
    const attachment = await this.supportTicketsService.getAttachment(
      user,
      attachmentId,
    );

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Length', attachment.size.toString());
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
    );
    response.send(Buffer.from(attachment.data));
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.supportTicketsService.findOne(user, id);
  }

  @Post(':id/messages')
  @UseInterceptors(
    FilesInterceptor(
      'attachments',
      MAX_SUPPORT_ATTACHMENTS,
      supportTicketUploadOptions,
    ),
  )
  addMessage(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSupportTicketMessageDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.supportTicketsService.addMessage(user, id, dto, files);
  }

  @Patch(':id/assignee')
  reassign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReassignSupportTicketDto,
  ) {
    return this.supportTicketsService.reassign(user, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketStatusDto,
  ) {
    return this.supportTicketsService.updateStatus(user, id, dto);
  }
}
