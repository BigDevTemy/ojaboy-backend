import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import { EmailService } from '../mail/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForgetPasswordDto } from './dto/forget-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOrderOtpDto } from './dto/request-order-otp.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyOrderOtpDto } from './dto/verify-order-otp.dto';
import { AuthUser, JwtPayload } from './interfaces/auth-user.interface';

const PASSWORD_AUTH_PROVIDER = 'password';
const GOOGLE_AUTH_PROVIDER = 'google';
const PASSWORD_SETUP_TOKEN_TTL_MS = 1000 * 60 * 60;
const ORDER_OTP_TTL_MS = 1000 * 60 * 10;
const ORDER_TOKEN_TTL_MS = 1000 * 60 * 30;
const ORDER_OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.toLowerCase();
    const existingUser = await this.findStoredUserByEmail(email);

    if (existingUser?.passwordHash) {
      throw new ConflictException('Email already exists');
    }

    if (existingUser) {
      await this.sendPasswordSetupVerification(existingUser);

      return {
        message:
          'A password setup verification link has been sent to your email.',
        email,
      };
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: registerDto.fullName.trim(),
        passwordHash: await hash(registerDto.password, 12),
        authProviders: [PASSWORD_AUTH_PROVIDER],
      },
    });

    await this.emailService.sendTemplateEmail({
      to: user.email,
      template: 'welcome-note',
      variables: {
        fullName: user.fullName,
        dashboardUrl: 'http://localhost:3000/dashboard',
        headerImageUrl:
          'https://res.cloudinary.com/jupit/image/upload/v1780399271/ojaboy-template-header.png',
        supportEmail: 'support@ojaboy.com',
      },
    });

    return this.buildAuthResponse(user);
  }

  async setPassword(setPasswordDto: SetPasswordDto) {
    const tokenHash = this.hashToken(setPasswordDto.token);
    const passwordSetupToken = await this.prisma.passwordSetupToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !passwordSetupToken ||
      passwordSetupToken.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Password setup link is invalid or expired',
      );
    }

    const authProviders = [
      ...new Set([
        ...passwordSetupToken.user.authProviders,
        PASSWORD_AUTH_PROVIDER,
      ]),
    ];

    const user = await this.prisma.user.update({
      where: { id: passwordSetupToken.userId },
      data: {
        passwordHash: await hash(setPasswordDto.password, 12),
        authProviders,
        passwordSetupTokens: {
          deleteMany: {},
        },
      },
    });

    return this.buildAuthResponse(user);
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.toLowerCase();
    let user: User | null;

    try {
      user = await this.findStoredUserByEmail(email);
    } catch (error) {
      this.logger.error(
        `Login failed while fetching user for email ${email}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Unable to login at this time. Please try again later.',
      );
    }

    if (
      !user ||
      !user.passwordHash ||
      !(await compare(loginDto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    const googleUser = await this.verifyGoogleIdToken(googleLoginDto.idToken);

    const existingProvider = await this.prisma.userAuthProvider.findUnique({
      where: {
        provider_providerUserId: {
          provider: GOOGLE_AUTH_PROVIDER,
          providerUserId: googleUser.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingProvider) {
      return this.buildAuthResponse(existingProvider.user);
    }

    const existingUser = await this.findStoredUserByEmail(googleUser.email);
    const user = existingUser
      ? await this.linkGoogleProviderToUser(
          existingUser,
          googleUser.providerUserId,
        )
      : await this.createGoogleUser(googleUser);

    await this.emailService.sendTemplateEmail({
      to: user.email,
      template: 'welcome-note',
      variables: {
        fullName: user.fullName,
        dashboardUrl: 'https://app.ojaboy.com/dashboard',
        headerImageUrl:
          'https://res.cloudinary.com/jupit/image/upload/v1780399271/ojaboy-template-header.png',
        supportEmail: 'support@ojaboy.com',
      },
    });

    return this.buildAuthResponse(user);
  }

  async forgetPassword(forgetPasswordDto: ForgetPasswordDto) {
    const email = forgetPasswordDto.email.toLowerCase();
    await this.findStoredUserByEmail(email);

    return {
      message:
        'If an account exists for this email, a password reset instruction will be sent.',
      email,
    };
  }

  async requestOrderOtp(dto: RequestOrderOtpDto) {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.findStoredUserByEmail(email);
    const fullName = dto.fullName?.trim() || existingUser?.fullName;

    if (!fullName) {
      throw new BadRequestException(
        'fullName is required when ordering with a new email address',
      );
    }

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + ORDER_OTP_TTL_MS);

    await this.prisma.$transaction([
      this.prisma.orderOtpChallenge.deleteMany({
        where: { email, consumedAt: null },
      }),
      this.prisma.orderOtpChallenge.create({
        data: {
          email,
          fullName,
          codeHash: this.hashOrderOtp(email, otp),
          expiresAt,
        },
      }),
    ]);

    await this.emailService.sendTemplateEmail({
      to: email,
      template: 'order-otp',
      variables: {
        fullName,
        otp,
        expiresIn: '10 minutes',
      },
    });

    return {
      message: 'A verification code has been sent to your email.',
      email,
      expiresIn: 600,
    };
  }

  async verifyOrderOtp(dto: VerifyOrderOtpDto) {
    const email = dto.email.toLowerCase().trim();
    try {
      const challenge = await this.prisma.orderOtpChallenge.findFirst({
        where: {
          email,
          consumedAt: null,
          expiresAt: { gt: new Date() },
          attempts: { lt: ORDER_OTP_MAX_ATTEMPTS },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!challenge) {
        throw new UnauthorizedException('OTP is invalid or expired');
      }

      if (challenge.codeHash !== this.hashOrderOtp(email, dto.otp)) {
        await this.prisma.orderOtpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: { increment: 1 } },
        });
        throw new UnauthorizedException('OTP is invalid or expired');
      }

      const orderToken = randomBytes(32).toString('hex');
      const orderTokenExpiresAt = new Date(Date.now() + ORDER_TOKEN_TTL_MS);

      await this.prisma.orderOtpChallenge.update({
        where: { id: challenge.id },
        data: {
          verifiedAt: new Date(),
          orderTokenHash: this.hashToken(orderToken),
          orderTokenExpiresAt,
        },
      });

      return {
        message: 'Email verified successfully.',
        email,
        orderToken,
        expiresIn: 1800,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.error(
        `Order OTP verification failed for email ${email}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new ServiceUnavailableException(
        'Unable to verify OTP at this time. Please try again later.',
      );
    }
  }

  async findAuthUserById(id: string): Promise<AuthUser | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return undefined;
    }

    return this.toAuthUser(user);
  }

  private findStoredUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  private async verifyGoogleIdToken(idToken: string) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');

    if (!clientId) {
      throw new InternalServerErrorException('Google login is not configured');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || !payload.email_verified) {
        throw new UnauthorizedException('Invalid Google account');
      }

      return {
        providerUserId: payload.sub,
        email: payload.email.toLowerCase(),
        fullName: payload.name?.trim() || payload.email,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      this.logger.warn(
        'Google login failed while verifying ID token',
        error instanceof Error ? error.stack : undefined,
      );

      throw new UnauthorizedException('Invalid Google token');
    }
  }

  private async linkGoogleProviderToUser(
    user: User,
    providerUserId: string,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        authProviders: [
          ...new Set([...user.authProviders, GOOGLE_AUTH_PROVIDER]),
        ],
        authProviderLinks: {
          create: {
            provider: GOOGLE_AUTH_PROVIDER,
            providerUserId,
          },
        },
      },
    });
  }

  private async createGoogleUser(googleUser: {
    email: string;
    fullName: string;
    providerUserId: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: googleUser.email,
        fullName: googleUser.fullName,
        passwordHash: null,
        authProviders: [GOOGLE_AUTH_PROVIDER],
        authProviderLinks: {
          create: {
            provider: GOOGLE_AUTH_PROVIDER,
            providerUserId: googleUser.providerUserId,
          },
        },
      },
    });
  }

  private async sendPasswordSetupVerification(user: User) {
    await this.prisma.passwordSetupToken.deleteMany({
      where: { userId: user.id },
    });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TOKEN_TTL_MS);

    await this.prisma.passwordSetupToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    const link = this.buildPasswordSetupLink(token);

    await this.emailService.sendTemplateEmail({
      to: user.email,
      template: 'password-setup',
      variables: {
        fullName: user.fullName,
        setupLink: link,
        expiresIn: '1 hour',
      },
    });
  }

  private buildPasswordSetupLink(token: string): string {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('CORS_ORIGIN') ??
      'http://localhost:3000';

    return `${frontendUrl}/set-password?token=${token}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashOrderOtp(email: string, otp: string): string {
    const secret =
      this.configService.get<string>('ORDER_OTP_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'dev-order-otp-secret';

    return createHmac('sha256', secret).update(`${email}:${otp}`).digest('hex');
  }

  private buildAuthResponse(user: User) {
    const authUser = this.toAuthUser(user);

    return {
      user: authUser,
      accessToken: this.createAccessToken(authUser),
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m',
    };
  }

  private createAccessToken(user: AuthUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      authProviders: user.authProviders,
    };
  }
}
