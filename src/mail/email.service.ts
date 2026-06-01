import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import {
  EmailTemplateName,
  EmailTemplateVariables,
} from './email-template.types';
import { renderEmailTemplate } from './templates';

interface SendTemplateEmailOptions {
  to: string;
  template: EmailTemplateName;
  variables: EmailTemplateVariables;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | undefined;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.from =
      this.configService.get<string>('SMTP_FROM') ??
      this.configService.get<string>('SMTP_USER') ??
      'no-reply@ojaboy.local';

    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);

    if (!host) {
      this.logger.warn(
        'SMTP_HOST is not configured. Emails will be logged instead of sent.',
      );
      return;
    }

    this.transporter = createTransport({
      host,
      port,
      secure:
        this.configService.get<string>('SMTP_SECURE') === 'true' ||
        port === 465,
      auth: this.getSmtpAuth(),
    });
  }

  async sendTemplateEmail(options: SendTemplateEmailOptions): Promise<void> {
    const renderedTemplate = renderEmailTemplate(
      options.template,
      options.variables,
    );

    if (!this.transporter) {
      this.logger.log(
        `Email fallback for ${options.to}: ${renderedTemplate.subject}\n${renderedTemplate.text}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to: options.to,
      subject: renderedTemplate.subject,
      html: renderedTemplate.html,
      text: renderedTemplate.text,
    });
  }

  private getSmtpAuth(): { user: string; pass: string } | undefined {
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!user || !pass) {
      return undefined;
    }

    return { user, pass };
  }
}
