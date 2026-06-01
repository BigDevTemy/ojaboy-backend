import {
  EmailTemplate,
  EmailTemplateName,
  EmailTemplateVariables,
  RenderedEmailTemplate,
} from './email-template.types';

function getValue(
  variables: EmailTemplateVariables,
  key: string,
  fallback = '',
): string {
  const value = variables[key];

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value === undefined ? fallback : String(value);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const templates: Record<EmailTemplateName, EmailTemplate> = {
  'password-setup': {
    subject: () => 'Set your Ojaboy password',
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const setupLink = escapeHtml(getValue(variables, 'setupLink'));
      const expiresIn = escapeHtml(getValue(variables, 'expiresIn', '1 hour'));

      return `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <h2 style="margin: 0 0 16px;">Set your password</h2>
          <p>Hello ${fullName},</p>
          <p>We received a request to add password sign in to your Ojaboy account.</p>
          <p>
            <a href="${setupLink}" style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px;">
              Set password
            </a>
          </p>
          <p>This link expires in ${expiresIn}. If you did not request this, you can safely ignore this email.</p>
        </div>
      `;
    },
    text: (variables) => {
      const fullName = getValue(variables, 'fullName', 'there');
      const setupLink = getValue(variables, 'setupLink');
      const expiresIn = getValue(variables, 'expiresIn', '1 hour');

      return [
        `Hello ${fullName},`,
        '',
        'We received a request to add password sign in to your Ojaboy account.',
        `Set your password here: ${setupLink}`,
        '',
        `This link expires in ${expiresIn}.`,
        'If you did not request this, you can safely ignore this email.',
      ].join('\n');
    },
  },
  'order-status': {
    subject: (variables) => {
      const orderStatus = getValue(variables, 'orderStatus', 'updated');

      return `Your order is ${orderStatus}`;
    },
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const orderNumber = escapeHtml(getValue(variables, 'orderNumber'));
      const orderStatus = escapeHtml(getValue(variables, 'orderStatus'));
      const orderMessage = escapeHtml(
        getValue(
          variables,
          'orderMessage',
          'Your order status has been updated.',
        ),
      );

      return `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <h2 style="margin: 0 0 16px;">Order update</h2>
          <p>Hello ${fullName},</p>
          <p>${orderMessage}</p>
          <p><strong>Order number:</strong> ${orderNumber}</p>
          <p><strong>Status:</strong> ${orderStatus}</p>
        </div>
      `;
    },
    text: (variables) => {
      const fullName = getValue(variables, 'fullName', 'there');
      const orderNumber = getValue(variables, 'orderNumber');
      const orderStatus = getValue(variables, 'orderStatus');
      const orderMessage = getValue(
        variables,
        'orderMessage',
        'Your order status has been updated.',
      );

      return [
        `Hello ${fullName},`,
        '',
        orderMessage,
        '',
        `Order number: ${orderNumber}`,
        `Status: ${orderStatus}`,
      ].join('\n');
    },
  },
};

export function renderEmailTemplate(
  name: EmailTemplateName,
  variables: EmailTemplateVariables,
): RenderedEmailTemplate {
  const template = templates[name];

  return {
    subject: template.subject(variables),
    html: template.html(variables),
    text: template.text(variables),
  };
}
