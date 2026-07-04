import { renderEmailTemplate } from './templates';

describe('email verification template', () => {
  it('renders the Ojaboy banner and verification call to action', () => {
    const rendered = renderEmailTemplate('email-verification', {
      fullName: 'Test Customer',
      verificationLink: 'https://app.ojaboy.com/verify-email?token=test-token',
      expiresIn: '1 hour',
      headerImageUrl: 'https://cdn.example.com/ojaboy-banner.png',
      supportEmail: 'support@ojaboy.com',
    });

    expect(rendered.subject).toBe('Verify your Ojaboy email address');
    expect(rendered.html).toContain(
      'https://cdn.example.com/ojaboy-banner.png',
    );
    expect(rendered.html).toContain('Verify Email Address');
    expect(rendered.html).toContain(
      'https://app.ojaboy.com/verify-email?token=test-token',
    );
    expect(rendered.text).toContain('This link expires in 1 hour.');
  });
});

describe('password reset template', () => {
  it('renders the reset call to action and fallback link', () => {
    const resetLink = 'https://app.ojaboy.com/reset-password?token=test-token';
    const rendered = renderEmailTemplate('password-reset', {
      fullName: 'Test Customer',
      resetLink,
      expiresIn: '1 hour',
      supportEmail: 'support@ojaboy.com',
    });

    expect(rendered.subject).toBe('Reset your Ojaboy password');
    expect(rendered.html).toContain('Reset Password');
    expect(rendered.html).toContain(resetLink);
    expect(rendered.text).toContain(`Reset your password here: ${resetLink}`);
    expect(rendered.text).toContain('This link expires in 1 hour.');
  });
});

describe('order status template', () => {
  it('normalizes enum statuses and highlights the latest status', () => {
    const rendered = renderEmailTemplate('order-status', {
      fullName: 'Test Customer',
      orderNumber: 'order-123',
      orderStatus: 'out_for_delivery',
      orderMessage: 'Your order status has been updated.',
      orderItems: [
        {
          productName: 'Tomatoes',
          quantity: '2',
          unit: 'kg',
          unitPrice: 'NGN 1,000.00',
          totalPrice: 'NGN 2,000.00',
        },
      ],
      subtotal: 'NGN 2,000.00',
      serviceFee: 'NGN 100.00',
      discountAmount: '',
      deliveryFee: 'NGN 500.00',
      total: 'NGN 2,600.00',
      note: '',
    });

    expect(rendered.subject).toBe('Your order is Out for Delivery');
    expect(rendered.html).toContain('Order Status Updated');
    expect(rendered.html).toContain('Current Status');
    expect(rendered.html).toContain('Out for Delivery');
    expect(rendered.html).not.toContain('out_for_delivery');
    expect(rendered.text).toContain('Status: Out for Delivery');
  });
});

describe('paystack bank transfer template', () => {
  it('renders the generated account details prominently', () => {
    const rendered = renderEmailTemplate('paystack-bank-transfer', {
      fullName: 'Test Customer',
      orderNumber: 'order-123',
      accountName: 'PAYSTACK-TITAN',
      accountNumber: '1234567890',
      bankName: 'Titan Bank',
      amount: '₦50,000.00',
      expiresAt: 'Jun 20, 2026, 2:15 PM',
      supportEmail: 'support@ojaboy.com',
    });

    expect(rendered.subject).toBe('Payment details for order order-123');
    expect(rendered.html).toContain('Complete Your Payment');
    expect(rendered.html).toContain('1234567890');
    expect(rendered.html).toContain('Titan Bank');
    expect(rendered.html).toContain('₦50,000.00');
    expect(rendered.text).toContain('Account number: 1234567890');
  });
});

describe('announcement coupon template', () => {
  it('renders the coupon badge and call to action', () => {
    const rendered = renderEmailTemplate('announcement-coupon', {
      fullName: 'Test Customer',
      title: 'A coupon just for you',
      body: 'Use this code at checkout for 15% off.',
      badgeValue: 'SAVE15',
      ctaLabel: 'Shop now',
      ctaUrl: 'https://app.ojaboy.com/shop',
      supportEmail: 'support@ojaboy.com',
    });

    expect(rendered.subject).toBe('A coupon just for you');
    expect(rendered.html).toContain('Coupon');
    expect(rendered.html).toContain('SAVE15');
    expect(rendered.html).toContain('Shop now');
    expect(rendered.html).toContain('https://app.ojaboy.com/shop');
    expect(rendered.text).toContain('SAVE15');
  });
});

describe('announcement closure template', () => {
  it('falls back to sensible defaults when optional variables are omitted', () => {
    const rendered = renderEmailTemplate('announcement-closure', {
      title: 'We will be closed for the holidays',
      body: 'Ojaboy will be closed from Dec 24 to Dec 26.',
    });

    expect(rendered.subject).toBe('We will be closed for the holidays');
    expect(rendered.html).toContain('Store Closure');
    expect(rendered.html).toContain('Hello there,');
    expect(rendered.html).not.toContain('<img');
    expect(rendered.text).toContain(
      'Ojaboy will be closed from Dec 24 to Dec 26.',
    );
  });

  it('renders the header image only when provided, and treats body as HTML', () => {
    const withHeader = renderEmailTemplate('announcement-closure', {
      title: 'We will be closed for the holidays',
      body: '<p>Ojaboy will be <strong>closed</strong> from Dec 24 to Dec 26.</p>',
      headerImageUrl: 'https://cdn.example.com/closure-banner.png',
    });

    expect(withHeader.html).toContain(
      '<img src="https://cdn.example.com/closure-banner.png"',
    );
    expect(withHeader.html).toContain(
      '<p>Ojaboy will be <strong>closed</strong> from Dec 24 to Dec 26.</p>',
    );
    expect(withHeader.text).toContain(
      'Ojaboy will be closed from Dec 24 to Dec 26.',
    );
    expect(withHeader.text).not.toContain('<strong>');

    const withoutHeader = renderEmailTemplate('announcement-closure', {
      title: 'We will be closed for the holidays',
      body: 'Ojaboy will be closed from Dec 24 to Dec 26.',
    });

    expect(withoutHeader.html).not.toContain('<img');
  });
});
