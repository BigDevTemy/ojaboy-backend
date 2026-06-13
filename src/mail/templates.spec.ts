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
