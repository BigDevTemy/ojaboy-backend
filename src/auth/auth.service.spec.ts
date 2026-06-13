import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { createHash, createHmac } from 'node:crypto';
import { AuthService } from './auth.service';

describe('AuthService order OTP verification', () => {
  it('authenticates an existing user without modifying the user record', async () => {
    const email = 'customer@example.com';
    const otp = '123456';
    const jwtSecret = 'test-jwt-secret';
    const challenge = {
      id: 'challenge-id',
      email,
      fullName: 'Test Customer',
      codeHash: createHmac('sha256', jwtSecret)
        .update(`${email}:${otp}`)
        .digest('hex'),
    };
    const existingUser = {
      id: 'user-id',
      email,
      fullName: 'Test Customer',
      passwordHash: null,
      authProviders: ['password'],
      role: 'user',
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(existingUser),
      },
      orderOtpChallenge: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      orderOtpChallenge: {
        findFirst: jest.fn().mockResolvedValue(challenge),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
      },
      userAddress: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return jwtSecret;
        if (key === 'JWT_EXPIRES_IN') return '1h';
        return undefined;
      }),
    } as unknown as ConfigService;
    const jwtService = {
      sign: jest.fn().mockReturnValue('jwt-access-token'),
    } as unknown as JwtService;
    const service = new AuthService(
      configService,
      jwtService,
      {} as never,
      prisma as never,
    );

    const response = await service.verifyOrderOtp({ email, otp });

    expect(tx.user.findUnique).toHaveBeenCalledWith({ where: { email } });
    expect(response).toMatchObject({
      message: 'Email verified successfully.',
      email,
      orderTokenExpiresIn: 1800,
      user: {
        id: 'user-id',
        email,
        fullName: 'Test Customer',
        role: 'user',
        authProviders: ['password'],
        hasAddress: false,
        hasDefaultAddress: false,
        defaultAddress: null,
      },
      accessToken: 'jwt-access-token',
      tokenType: 'Bearer',
      expiresIn: '1h',
    });
    expect(response.orderToken).toHaveLength(64);
    expect(response.refreshToken).toHaveLength(96);
  });

  it('rotates a valid refresh token', async () => {
    const refreshToken = 'original-refresh-token';
    const existingUser = {
      id: 'user-id',
      email: 'customer@example.com',
      fullName: 'Test Customer',
      passwordHash: null,
      authProviders: ['password'],
      role: 'user',
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const storedToken = {
      id: 'refresh-id',
      userId: existingUser.id,
      familyId: 'family-id',
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: new Date(),
      user: existingUser,
    };
    const tx = {
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue(storedToken),
        updateMany: jest.fn(),
      },
      userAddress: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'JWT_EXPIRES_IN' ? '1h' : undefined,
      ),
    } as unknown as ConfigService;
    const jwtService = {
      sign: jest.fn().mockReturnValue('new-access-token'),
    } as unknown as JwtService;
    const service = new AuthService(
      configService,
      jwtService,
      {} as never,
      prisma as never,
    );

    const response = await service.refresh(refreshToken);

    const rotateCalls = tx.refreshToken.updateMany.mock
      .calls as unknown as Array<
      [
        {
          where: { id: string; revokedAt: null };
          data: { revokedAt: Date; replacedByTokenId: string };
        },
      ]
    >;
    const rotateCall = rotateCalls[0][0];
    expect(rotateCall.where).toEqual({
      id: 'refresh-id',
      revokedAt: null,
    });
    expect(rotateCall.data.revokedAt).toBeInstanceOf(Date);
    expect(typeof rotateCall.data.replacedByTokenId).toBe('string');
    expect(response).toMatchObject({
      accessToken: 'new-access-token',
      user: {
        id: 'user-id',
        email: 'customer@example.com',
      },
    });
    expect(response.refreshToken).toHaveLength(96);
    expect(response.refreshToken).not.toBe(refreshToken);
  });

  it('revokes a token family when a rotated token is reused', async () => {
    const familyRevoke = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          familyId: 'family-id',
          revokedAt: new Date(),
        }),
        updateMany: familyRevoke,
      },
    };
    const service = new AuthService(
      {} as ConfigService,
      {} as JwtService,
      {} as never,
      prisma as never,
    );

    await expect(service.refresh('reused-token')).rejects.toThrow(
      'Refresh token reuse detected',
    );
    const revokeCalls = familyRevoke.mock.calls as unknown as Array<
      [
        {
          where: { familyId: string; revokedAt: null };
          data: { revokedAt: Date };
        },
      ]
    >;
    const revokeCall = revokeCalls[0][0];
    expect(revokeCall.where).toEqual({
      familyId: 'family-id',
      revokedAt: null,
    });
    expect(revokeCall.data.revokedAt).toBeInstanceOf(Date);
  });

  it('blocks password login until the email is verified', async () => {
    const password = 'password123';
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-id',
          email: 'customer@example.com',
          fullName: 'Test Customer',
          passwordHash: await hash(password, 4),
          authProviders: ['password'],
          role: 'user',
          emailVerifiedAt: null,
        }),
      },
    };
    const service = new AuthService(
      {} as ConfigService,
      {} as JwtService,
      {} as never,
      prisma as never,
    );

    await expect(
      service.login({ email: 'customer@example.com', password }),
    ).rejects.toMatchObject({
      response: {
        code: 'EMAIL_NOT_VERIFIED',
      },
    });
  });

  it('verifies an email and creates an authenticated session', async () => {
    const user = {
      id: 'user-id',
      email: 'customer@example.com',
      fullName: 'Test Customer',
      passwordHash: 'password-hash',
      authProviders: ['password'],
      role: 'user',
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sendTemplateEmail = jest.fn().mockResolvedValue(undefined);
    const defaultAddress = {
      id: 'address-id',
      userId: user.id,
      isDefault: true,
      deliveryZone: {
        id: 'zone-id',
        name: 'Lagos',
      },
    };
    const prisma = {
      emailVerificationToken: {
        findUnique: jest.fn().mockResolvedValue({
          userId: user.id,
          expiresAt: new Date(Date.now() + 60_000),
          user: { ...user, emailVerifiedAt: null },
        }),
      },
      user: {
        update: jest.fn().mockResolvedValue(user),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
      },
      userAddress: {
        findFirst: jest.fn().mockResolvedValue(defaultAddress),
      },
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('access-token'),
    } as unknown as JwtService;
    const configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new AuthService(
      configService,
      jwtService,
      { sendTemplateEmail } as never,
      prisma as never,
    );

    const response = await service.verifyEmail({
      token: 'a'.repeat(64),
    });

    const verifyCalls = prisma.user.update.mock.calls as unknown as Array<
      [
        {
          where: { id: string };
          data: {
            emailVerifiedAt: Date;
            emailVerificationTokens: {
              deleteMany: Record<string, never>;
            };
          };
        },
      ]
    >;
    const verifyCall = verifyCalls[0][0];
    expect(verifyCall.where).toEqual({ id: user.id });
    expect(verifyCall.data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(verifyCall.data.emailVerificationTokens).toEqual({
      deleteMany: {},
    });
    expect(response).toMatchObject({
      accessToken: 'access-token',
      user: {
        email: user.email,
        emailVerified: true,
        hasAddress: true,
        hasDefaultAddress: true,
        defaultAddress,
      },
    });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'welcome-note' }),
    );
  });
});
