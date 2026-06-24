import { BadRequestException } from '@nestjs/common';

export const MAX_SUPPORT_ATTACHMENTS = 5;
export const MAX_SUPPORT_ATTACHMENT_SIZE = 10 * 1024 * 1024;

export const ALLOWED_SUPPORT_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const supportTicketUploadOptions = {
  limits: {
    files: MAX_SUPPORT_ATTACHMENTS,
    fileSize: MAX_SUPPORT_ATTACHMENT_SIZE,
  },
  fileFilter: (
    _request: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_SUPPORT_ATTACHMENT_TYPES.has(file.mimetype)) {
      callback(
        new BadRequestException(
          'Attachments must be JPEG, PNG, WebP, PDF, DOC, or DOCX files',
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};
