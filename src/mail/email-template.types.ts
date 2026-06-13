export type EmailTemplateName =
  | 'email-verification'
  | 'password-setup'
  | 'order-status'
  | 'order-otp'
  | 'welcome-note';

export interface OrderEmailItem {
  productName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
}

export type EmailTemplateVariables = Record<
  string,
  string | number | Date | OrderEmailItem[]
>;

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
