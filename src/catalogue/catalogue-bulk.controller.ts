import {
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CatalogueBulkService } from './catalogue-bulk.service';

@Controller('product-catalogue/bulk-upload')
export class CatalogueBulkController {
  constructor(private readonly catalogueBulkService: CatalogueBulkService) {}

  @Get('template')
  async downloadTemplate(@Res() response: Response) {
    const template = await this.catalogueBulkService.createTemplate();
    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="product-catalogue-bulk-upload-template.xlsx"',
    );
    response.send(template);
  }

  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  validate(@UploadedFile() file?: Express.Multer.File) {
    return this.catalogueBulkService.validate(file);
  }

  @Post('commit')
  @UseInterceptors(FileInterceptor('file'))
  commit(@UploadedFile() file?: Express.Multer.File) {
    return this.catalogueBulkService.commit(file);
  }
}
