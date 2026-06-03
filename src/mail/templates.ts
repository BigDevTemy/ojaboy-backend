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
  'welcome-note': {
    subject: (variables) => {
      const fullName = getValue(variables, 'fullName', 'there');

      return `Welcome to Ojaboy, ${fullName}`;
    },
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const dashboardUrl = escapeHtml(getValue(variables, 'dashboardUrl', '#'));
      const headerImageUrl = escapeHtml(
        getValue(variables, 'headerImageUrl', ''),
      );
      const supportEmail = escapeHtml(
        getValue(variables, 'supportEmail', 'support@ojaboy.com'),
      );

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Welcome to Ojaboy</title>
          </head>
          <body style="margin:0; padding:0; background:#f7f7f7; font-family:Arial, Helvetica, sans-serif; color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7; padding:40px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 35px rgba(0,0,0,0.08);">
                    <tr>
                      <td style="padding:0; background:#ffffff;">
                        <img src="${headerImageUrl}" alt="Ojaboy Market Intelligence" width="640" style="width:100%; max-width:640px; height:auto; display:block; border:0; outline:none; text-decoration:none;" />
                      </td>
                    </tr>

                    <tr>
                      <td align="center" style="padding:35px 55px 25px;">
                        <h2 style="margin:0 0 15px; font-size:32px; line-height:1.25; font-weight:800; color:#111111;">
                          Welcome to Ojaboy!
                        </h2>
                        <p style="margin:0 auto; max-width:500px; font-size:16px; line-height:1.7; color:#555555;">
                          Hello ${fullName}, we&rsquo;re excited to have you onboard. Ojaboy helps you track market prices,
                          compare markets, receive smart shopping recommendations, and make better buying decisions.
                        </p>
                      </td>
                    </tr>

                    <tr>
                      <td align="center" style="padding:5px 55px 30px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff0f0; border-radius:16px;">
                          <tr>
                            <td style="padding:28px;">
                              <p style="margin:0 0 18px; color:#e60000; font-size:20px; line-height:1.3; font-weight:800;">
                                With Ojaboy, you can:
                              </p>

                              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                  <td width="62" style="padding:13px 0; border-bottom:1px dashed #ffd0d0;">
                                    <div style="width:42px; height:42px; background:#ffffff; color:#f20505; border-radius:50%; text-align:center; line-height:42px; box-shadow:0 5px 15px rgba(242,5,5,0.12);">+</div>
                                  </td>
                                  <td style="padding:13px 0; border-bottom:1px dashed #ffd0d0; font-size:16px; line-height:1.4; color:#111827;">
                                    Monitor daily market price changes
                                  </td>
                                </tr>
                                <tr>
                                  <td width="62" style="padding:13px 0; border-bottom:1px dashed #ffd0d0;">
                                    <div style="width:42px; height:42px; background:#ffffff; color:#f20505; border-radius:50%; text-align:center; line-height:42px; box-shadow:0 5px 15px rgba(242,5,5,0.12);">#</div>
                                  </td>
                                  <td style="padding:13px 0; border-bottom:1px dashed #ffd0d0; font-size:16px; line-height:1.4; color:#111827;">
                                    Compare prices across different markets
                                  </td>
                                </tr>
                                <tr>
                                  <td width="62" style="padding:13px 0; border-bottom:1px dashed #ffd0d0;">
                                    <div style="width:42px; height:42px; background:#ffffff; color:#f20505; border-radius:50%; text-align:center; line-height:42px; box-shadow:0 5px 15px rgba(242,5,5,0.12);">!</div>
                                  </td>
                                  <td style="padding:13px 0; border-bottom:1px dashed #ffd0d0; font-size:16px; line-height:1.4; color:#111827;">
                                    Get alerts when prices rise or drop
                                  </td>
                                </tr>
                                <tr>
                                  <td width="62" style="padding:13px 0; border-bottom:1px dashed #ffd0d0;">
                                    <div style="width:42px; height:42px; background:#ffffff; color:#f20505; border-radius:50%; text-align:center; line-height:42px; box-shadow:0 5px 15px rgba(242,5,5,0.12);">AI</div>
                                  </td>
                                  <td style="padding:13px 0; border-bottom:1px dashed #ffd0d0; font-size:16px; line-height:1.4; color:#111827;">
                                    Receive AI-powered shopping advice
                                  </td>
                                </tr>
                                <tr>
                                  <td width="62" style="padding:13px 0;">
                                    <div style="width:42px; height:42px; background:#ffffff; color:#f20505; border-radius:50%; text-align:center; line-height:42px; box-shadow:0 5px 15px rgba(242,5,5,0.12);">$</div>
                                  </td>
                                  <td style="padding:13px 0; font-size:16px; line-height:1.4; color:#111827;">
                                    Discover the best market to buy from
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td align="center" style="padding:0 55px 40px;">
                        <a href="${dashboardUrl}" style="display:inline-block; background:#f20505; color:#ffffff; text-decoration:none; padding:17px 70px; border-radius:10px; font-size:18px; line-height:1.2; font-weight:bold;">
                          Go to Dashboard &rarr;
                        </a>
                      </td>
                    </tr>

                    <tr>
                      <td align="center" style="margin:0; padding:28px 55px 35px; border-top:1px solid #eeeeee; text-align:center; color:#555555; font-size:14px; line-height:1.6;">
                        <strong>Need help?</strong><br />
                        Contact us at <a href="mailto:${supportEmail}" style="color:#e60000; text-decoration:none; font-weight:bold;">${supportEmail}</a>
                        <div style="margin-top:25px; font-size:13px; color:#999999;">
                          &copy; 2026 Ojaboy. All rights reserved.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `;
    },
    text: (variables) => {
      const fullName = getValue(variables, 'fullName', 'there');
      const dashboardUrl = getValue(variables, 'dashboardUrl', '#');
      const supportEmail = getValue(
        variables,
        'supportEmail',
        'support@ojaboy.com',
      );

      return [
        `Hello ${fullName},`,
        '',
        'Welcome to Ojaboy. We are excited to have you onboard.',
        'Ojaboy helps you track market prices, compare markets, receive smart shopping recommendations, and make better buying decisions.',
        '',
        'With Ojaboy, you can:',
        '- Monitor daily market price changes',
        '- Compare prices across different markets',
        '- Get alerts when prices rise or drop',
        '- Receive AI-powered shopping advice',
        '- Discover the best market to buy from',
        '',
        `Go to Dashboard: ${dashboardUrl}`,
        '',
        `Need help? Contact us at ${supportEmail}`,
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
