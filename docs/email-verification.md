# Email Verification

Password registration creates an unverified account and sends an Ojaboy-branded
verification email. It does not issue access or refresh tokens.

The email button opens:

```text
{FRONTEND_URL}/verify-email?token={verification-token}
```

The frontend reads the token and submits it to:

```http
POST /auth/email/verify
Content-Type: application/json
```

```json
{
  "token": "verification-token-from-the-url"
}
```

Successful verification marks the email verified, sends the welcome email,
returns an access token, and sets the refresh-token cookie.

The returned user includes address onboarding state:

```json
{
  "hasAddress": true,
  "hasDefaultAddress": true,
  "defaultAddress": {
    "id": "address-id",
    "isDefault": true,
    "deliveryZone": {}
  }
}
```

The same fields are returned by login, OTP authentication, password setup, and
token refresh. The frontend should force address onboarding when
`hasDefaultAddress` is `false`.

To resend a verification email:

```http
POST /auth/email/resend
Content-Type: application/json
```

```json
{
  "email": "customer@example.com"
}
```

Password login returns `403 EMAIL_NOT_VERIFIED` until verification succeeds.
Google SSO accounts are marked verified from Google's verified email claim.
