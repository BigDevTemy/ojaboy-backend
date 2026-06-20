import {
  EmailTemplate,
  EmailTemplateName,
  EmailTemplateVariables,
  OrderEmailItem,
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

  if (Array.isArray(value)) {
    return fallback;
  }

  return value === undefined ? fallback : String(value);
}

function getOrderItems(variables: EmailTemplateVariables): OrderEmailItem[] {
  const items = variables.orderItems;

  return Array.isArray(items) ? items : [];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOrderStatus(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim();

  if (!normalized) {
    return 'Updated';
  }

  return normalized
    .split(/\s+/)
    .map((word, index) => {
      const lowerWord = word.toLowerCase();

      if (index > 0 && ['for', 'of', 'to'].includes(lowerWord)) {
        return lowerWord;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

const templates: Record<EmailTemplateName, EmailTemplate> = {
  'email-verification': {
    subject: () => 'Verify your Ojaboy email address',
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const verificationLink = escapeHtml(
        getValue(variables, 'verificationLink'),
      );
      const expiresIn = escapeHtml(getValue(variables, 'expiresIn', '1 hour'));
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
            <title>Verify your Ojaboy email</title>
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
                      <td align="center" style="padding:40px 55px 20px;">
                        <h2 style="margin:0 0 15px; font-size:30px; line-height:1.25; font-weight:800; color:#111111;">
                          Verify your email address
                        </h2>
                        <p style="margin:0 auto; max-width:500px; font-size:16px; line-height:1.7; color:#555555;">
                          Hello ${fullName}, welcome to Ojaboy. Confirm your email address to activate your account and securely start using Ojaboy.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:15px 55px 35px;">
                        <a href="${verificationLink}" style="display:inline-block; background:#f20505; color:#ffffff; text-decoration:none; padding:17px 56px; border-radius:10px; font-size:18px; line-height:1.2; font-weight:bold;">
                          Verify Email Address
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 35px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff0f0; border-radius:14px;">
                          <tr>
                            <td style="padding:22px; color:#555555; font-size:14px; line-height:1.7;">
                              This verification link expires in <strong>${expiresIn}</strong>. If you did not create an Ojaboy account, you can safely ignore this email.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 35px; color:#777777; font-size:13px; line-height:1.6; word-break:break-all;">
                        If the button does not work, open this link:<br />
                        <a href="${verificationLink}" style="color:#e60000;">${verificationLink}</a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:28px 55px 35px; border-top:1px solid #eeeeee; color:#555555; font-size:14px; line-height:1.6;">
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
      const verificationLink = getValue(variables, 'verificationLink');
      const expiresIn = getValue(variables, 'expiresIn', '1 hour');
      const supportEmail = getValue(
        variables,
        'supportEmail',
        'support@ojaboy.com',
      );

      return [
        `Hello ${fullName},`,
        '',
        'Welcome to Ojaboy. Verify your email address to activate your account.',
        `Verify your email: ${verificationLink}`,
        '',
        `This link expires in ${expiresIn}.`,
        'If you did not create this account, you can safely ignore this email.',
        '',
        `Need help? Contact ${supportEmail}`,
      ].join('\n');
    },
  },
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
  'password-reset': {
    subject: () => 'Reset your Ojaboy password',
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const resetLink = escapeHtml(getValue(variables, 'resetLink'));
      const expiresIn = escapeHtml(getValue(variables, 'expiresIn', '1 hour'));
      const supportEmail = escapeHtml(
        getValue(variables, 'supportEmail', 'support@ojaboy.com'),
      );

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Reset your Ojaboy password</title>
          </head>
          <body style="margin:0; padding:0; background:#f7f7f7; font-family:Arial, Helvetica, sans-serif; color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7; padding:40px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 35px rgba(0,0,0,0.08);">
                    <tr>
                      <td align="center" style="padding:40px 55px 20px;">
                        <h2 style="margin:0 0 15px; font-size:30px; line-height:1.25; font-weight:800; color:#111111;">
                          Reset your password
                        </h2>
                        <p style="margin:0 auto; max-width:500px; font-size:16px; line-height:1.7; color:#555555;">
                          Hello ${fullName}, we received a request to change the password for your Ojaboy account.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:15px 55px 35px;">
                        <a href="${resetLink}" style="display:inline-block; background:#f20505; color:#ffffff; text-decoration:none; padding:17px 56px; border-radius:10px; font-size:18px; line-height:1.2; font-weight:bold;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 35px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff0f0; border-radius:14px;">
                          <tr>
                            <td style="padding:22px; color:#555555; font-size:14px; line-height:1.7;">
                              This password reset link expires in <strong>${expiresIn}</strong>. If you did not request it, you can safely ignore this email.
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 35px; color:#777777; font-size:13px; line-height:1.6; word-break:break-all;">
                        If the button does not work, open this link:<br />
                        <a href="${resetLink}" style="color:#e60000;">${resetLink}</a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:28px 55px 35px; border-top:1px solid #eeeeee; color:#555555; font-size:14px; line-height:1.6;">
                        <strong>Need help?</strong><br />
                        Contact us at <a href="mailto:${supportEmail}" style="color:#e60000; text-decoration:none; font-weight:bold;">${supportEmail}</a>
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
      const resetLink = getValue(variables, 'resetLink');
      const expiresIn = getValue(variables, 'expiresIn', '1 hour');
      const supportEmail = getValue(
        variables,
        'supportEmail',
        'support@ojaboy.com',
      );

      return [
        `Hello ${fullName},`,
        '',
        'We received a request to change the password for your Ojaboy account.',
        `Reset your password here: ${resetLink}`,
        '',
        `This link expires in ${expiresIn}.`,
        'If you did not request it, you can safely ignore this email.',
        '',
        `Need help? Contact ${supportEmail}`,
      ].join('\n');
    },
  },
  'paystack-bank-transfer': {
    subject: (variables) => {
      const orderNumber = getValue(variables, 'orderNumber');

      return orderNumber
        ? `Payment details for order ${orderNumber}`
        : 'Your Ojaboy payment details';
    },
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const orderNumber = escapeHtml(getValue(variables, 'orderNumber'));
      const accountName = escapeHtml(getValue(variables, 'accountName', '-'));
      const accountNumber = escapeHtml(getValue(variables, 'accountNumber'));
      const bankName = escapeHtml(getValue(variables, 'bankName', '-'));
      const amount = escapeHtml(getValue(variables, 'amount'));
      const expiresAt = escapeHtml(getValue(variables, 'expiresAt', 'soon'));
      const supportEmail = escapeHtml(
        getValue(variables, 'supportEmail', 'support@ojaboy.com'),
      );

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Ojaboy payment details</title>
          </head>
          <body style="margin:0; padding:0; background:#f7f7f7; font-family:Arial, Helvetica, sans-serif; color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7; padding:40px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 35px rgba(0,0,0,0.08);">
                    <tr>
                      <td align="center" style="padding:38px 55px 16px;">
                        <h2 style="margin:0 0 12px; font-size:32px; line-height:1.25; font-weight:800; color:#111111;">
                          Complete Your Payment
                        </h2>
                        <p style="margin:0 auto; max-width:500px; font-size:16px; line-height:1.7; color:#555555;">
                          Hello ${fullName}, please transfer the exact amount below to complete your Ojaboy order.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:12px 55px 30px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff0f0; border-radius:16px;">
                          <tr>
                            <td align="center" style="padding:28px 22px;">
                              <div style="margin:0 0 9px; color:#e60000; font-size:13px; line-height:1.4; font-weight:800; text-transform:uppercase; letter-spacing:1.5px;">
                                Bank Account Number
                              </div>
                              <div style="display:inline-block; background:#f20505; color:#ffffff; padding:16px 34px; border-radius:999px; font-size:28px; line-height:1.2; font-weight:800; letter-spacing:1px;">
                                ${accountNumber}
                              </div>
                              <div style="margin-top:18px; color:#555555; font-size:14px; line-height:1.6;">
                                Order number: <strong style="color:#111111;">${orderNumber}</strong>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 35px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafafa; border-radius:14px; font-size:15px; line-height:1.6;">
                          <tr>
                            <td style="padding:20px 22px;">
                              <p style="margin:0 0 10px;"><strong>Bank:</strong> <span style="float:right;">${bankName}</span></p>
                              <p style="margin:0 0 10px;"><strong>Account name:</strong> <span style="float:right;">${accountName}</span></p>
                              <p style="margin:0 0 10px;"><strong>Amount:</strong> <strong style="float:right; color:#e60000;">${amount}</strong></p>
                              <p style="margin:0;"><strong>Expires:</strong> <span style="float:right;">${expiresAt}</span></p>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:18px 0 0; color:#555555; font-size:14px; line-height:1.7;">
                          Use this account for this order only. Your order will be updated automatically once payment is confirmed.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:28px 55px 35px; border-top:1px solid #eeeeee; color:#555555; font-size:14px; line-height:1.6;">
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
      const orderNumber = getValue(variables, 'orderNumber');
      const accountName = getValue(variables, 'accountName', '-');
      const accountNumber = getValue(variables, 'accountNumber');
      const bankName = getValue(variables, 'bankName', '-');
      const amount = getValue(variables, 'amount');
      const expiresAt = getValue(variables, 'expiresAt', 'soon');
      const supportEmail = getValue(
        variables,
        'supportEmail',
        'support@ojaboy.com',
      );

      return [
        `Hello ${fullName},`,
        '',
        `Payment details for order ${orderNumber}`,
        `Bank: ${bankName}`,
        `Account name: ${accountName}`,
        `Account number: ${accountNumber}`,
        `Amount: ${amount}`,
        `Expires: ${expiresAt}`,
        '',
        'Use this account for this order only. Your order will be updated automatically once payment is confirmed.',
        '',
        `Need help? Contact ${supportEmail}`,
      ].join('\n');
    },
  },
  'order-status': {
    subject: (variables) => {
      const orderStatus = formatOrderStatus(
        getValue(variables, 'orderStatus', 'updated'),
      );

      return `Your order is ${orderStatus}`;
    },
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const orderNumber = escapeHtml(getValue(variables, 'orderNumber'));
      const orderStatus = escapeHtml(
        formatOrderStatus(getValue(variables, 'orderStatus')),
      );
      const subtotal = escapeHtml(getValue(variables, 'subtotal'));
      const discountAmount = escapeHtml(getValue(variables, 'discountAmount'));
      const serviceFee = escapeHtml(getValue(variables, 'serviceFee'));
      const deliveryFee = escapeHtml(getValue(variables, 'deliveryFee'));
      const total = escapeHtml(getValue(variables, 'total'));
      const note = escapeHtml(getValue(variables, 'note'));
      const orderItems = getOrderItems(variables);
      const orderMessage = escapeHtml(
        getValue(
          variables,
          'orderMessage',
          'Your order status has been updated.',
        ),
      );
      const itemRows = orderItems
        .map(
          (item) => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.productName)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(item.unitPrice)}</td>
              <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(item.totalPrice)}</td>
            </tr>
          `,
        )
        .join('');

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Ojaboy order update</title>
          </head>
          <body style="margin:0; padding:0; background:#f7f7f7; font-family:Arial, Helvetica, sans-serif; color:#111827;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7; padding:40px 12px;">
              <tr>
                <td align="center">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 35px rgba(0,0,0,0.08);">
                    <tr>
                      <td align="center" style="padding:38px 55px 16px;">
                        <h2 style="margin:0 0 12px; font-size:32px; line-height:1.25; font-weight:800; color:#111111;">
                          Order Status Updated
                        </h2>
                        <p style="margin:0 auto; max-width:500px; font-size:16px; line-height:1.7; color:#555555;">
                          Hello ${fullName}, ${orderMessage}
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:12px 55px 30px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff0f0; border-radius:16px;">
                          <tr>
                            <td align="center" style="padding:28px 22px;">
                              <div style="margin:0 0 9px; color:#e60000; font-size:13px; line-height:1.4; font-weight:800; text-transform:uppercase; letter-spacing:1.5px;">
                                Current Status
                              </div>
                              <div style="display:inline-block; background:#f20505; color:#ffffff; padding:16px 34px; border-radius:999px; font-size:28px; line-height:1.2; font-weight:800;">
                                ${orderStatus}
                              </div>
                              <div style="margin-top:18px; color:#555555; font-size:14px; line-height:1.6;">
                                Order number: <strong style="color:#111111;">${orderNumber}</strong>
                              </div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 20px;">
                        <h3 style="margin:0 0 14px; font-size:20px; line-height:1.3; color:#111111;">Order Summary</h3>
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse; font-size:14px; line-height:1.5;">
                          <thead>
                            <tr style="background:#f3f4f6;">
                              <th style="padding:12px 10px; text-align:left; color:#111827;">Product</th>
                              <th style="padding:12px 10px; text-align:left; color:#111827;">Qty</th>
                              <th style="padding:12px 10px; text-align:right; color:#111827;">Unit</th>
                              <th style="padding:12px 10px; text-align:right; color:#111827;">Total</th>
                            </tr>
                          </thead>
                          <tbody>${itemRows}</tbody>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 55px 35px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafafa; border-radius:14px; font-size:15px; line-height:1.6;">
                          <tr>
                            <td style="padding:20px 22px;">
                              <p style="margin:0 0 8px;"><strong>Subtotal:</strong> <span style="float:right;">${subtotal}</span></p>
                              ${discountAmount ? `<p style="margin:0 0 8px;"><strong>Discount:</strong> <span style="float:right;">-${discountAmount}</span></p>` : ''}
                              <p style="margin:0 0 8px;"><strong>Service fee:</strong> <span style="float:right;">${serviceFee}</span></p>
                              <p style="margin:0 0 12px;"><strong>Delivery fee:</strong> <span style="float:right;">${deliveryFee}</span></p>
                              <p style="margin:12px 0 0; padding-top:12px; border-top:1px solid #e5e7eb; font-size:18px;"><strong>Total:</strong> <strong style="float:right; color:#e60000;">${total}</strong></p>
                            </td>
                          </tr>
                        </table>
                        ${note ? `<p style="margin:18px 0 0; color:#555555; font-size:14px; line-height:1.6;"><strong>Order note:</strong> ${note}</p>` : ''}
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:28px 55px 35px; border-top:1px solid #eeeeee; color:#555555; font-size:14px; line-height:1.6;">
                        Thank you for shopping with Ojaboy.
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
      const orderNumber = getValue(variables, 'orderNumber');
      const orderStatus = formatOrderStatus(getValue(variables, 'orderStatus'));
      const subtotal = getValue(variables, 'subtotal');
      const discountAmount = getValue(variables, 'discountAmount');
      const serviceFee = getValue(variables, 'serviceFee');
      const deliveryFee = getValue(variables, 'deliveryFee');
      const total = getValue(variables, 'total');
      const note = getValue(variables, 'note');
      const orderItems = getOrderItems(variables);
      const orderMessage = getValue(
        variables,
        'orderMessage',
        'Your order status has been updated.',
      );
      const itemLines = orderItems.map(
        (item) =>
          `- ${item.productName}: ${item.quantity} ${item.unit} x ${item.unitPrice} = ${item.totalPrice}`,
      );

      return [
        `Hello ${fullName},`,
        '',
        orderMessage,
        '',
        `Order number: ${orderNumber}`,
        `Status: ${orderStatus}`,
        '',
        'Items:',
        ...itemLines,
        '',
        `Subtotal: ${subtotal}`,
        ...(discountAmount ? [`Discount: -${discountAmount}`] : []),
        `Service fee: ${serviceFee}`,
        `Delivery fee: ${deliveryFee}`,
        `Total: ${total}`,
        ...(note ? ['', `Order note: ${note}`] : []),
      ].join('\n');
    },
  },
  'order-otp': {
    subject: () => 'Your Ojaboy order verification code',
    html: (variables) => {
      const fullName = escapeHtml(getValue(variables, 'fullName', 'there'));
      const otp = escapeHtml(getValue(variables, 'otp'));
      const expiresIn = escapeHtml(
        getValue(variables, 'expiresIn', '10 minutes'),
      );

      return `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <h2 style="margin: 0 0 16px;">Verify your order</h2>
          <p>Hello ${fullName},</p>
          <p>Use this code to continue placing your Ojaboy order:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px;">${otp}</p>
          <p>This code expires in ${expiresIn}. Do not share it with anyone.</p>
        </div>
      `;
    },
    text: (variables) => {
      const fullName = getValue(variables, 'fullName', 'there');
      const otp = getValue(variables, 'otp');
      const expiresIn = getValue(variables, 'expiresIn', '10 minutes');

      return [
        `Hello ${fullName},`,
        '',
        `Your Ojaboy order verification code is: ${otp}`,
        `This code expires in ${expiresIn}.`,
        'Do not share it with anyone.',
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
