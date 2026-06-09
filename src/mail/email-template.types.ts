export type EmailTemplateName =
  | 'password-setup'
  | 'order-status'
  | 'order-otp'
  | 'welcome-note';

export type EmailTemplateVariables = Record<string, string | number | Date>;

export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplate {
  subject: (variables: EmailTemplateVariables) => string;
  html: (variables: EmailTemplateVariables) => string;
  text: (variables: EmailTemplateVariables) => string;
}
