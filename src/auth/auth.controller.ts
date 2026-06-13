import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ForgetPasswordDto } from './dto/forget-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { RequestOrderOtpDto } from './dto/request-order-otp.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyOrderOtpDto } from './dto/verify-order-otp.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './interfaces/auth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      await this.authService.register(registerDto),
      response,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      await this.authService.login(loginDto),
      response,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('email/verify')
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      await this.authService.verifyEmail(dto),
      response,
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('email/resend')
  resendEmailVerification(@Body() dto: ResendEmailVerificationDto) {
    return this.authService.resendEmailVerification(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  async googleLogin(
    @Body() googleLoginDto: GoogleLoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      await this.authService.googleLogin(googleLoginDto),
      response,
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forget-password')
  forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    return this.authService.forgetPassword(forgetPasswordDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set-password')
  async setPassword(
    @Body() setPasswordDto: SetPasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      await this.authService.setPassword(setPasswordDto),
      response,
    );
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('order-otp/request')
  requestOrderOtp(@Body() dto: RequestOrderOtpDto) {
    return this.authService.requestOrderOtp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('order-otp/verify')
  async verifyOrderOtp(
    @Body() dto: VerifyOrderOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.withRefreshCookie(
      await this.authService.verifyOrderOtp(dto),
      response,
    );
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      this.getRefreshToken(request),
    );

    return this.withRefreshCookie(result, response);
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logout(
      this.getRefreshToken(request, false),
    );
    this.clearRefreshCookie(response);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.logoutAll(user.id);
    this.clearRefreshCookie(response);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return user;
  }

  private withRefreshCookie<T extends Record<string, unknown>>(
    result: T,
    response: Response,
  ): Omit<T, 'refreshToken'> {
    const { refreshToken, ...publicResult } = result;

    if (typeof refreshToken === 'string') {
      response.cookie(
        this.getRefreshCookieName(),
        refreshToken,
        this.getRefreshCookieOptions(),
      );
    }

    return publicResult;
  }

  private getRefreshToken(request: Request, required = true): string {
    const cookieHeader = request.headers.cookie ?? '';
    const cookieName = this.getRefreshCookieName();
    const refreshToken = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);

    if (!refreshToken && required) {
      throw new UnauthorizedException('Refresh token is required');
    }

    return refreshToken ? decodeURIComponent(refreshToken) : '';
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(
      this.getRefreshCookieName(),
      this.getRefreshCookieOptions(),
    );
  }

  private getRefreshCookieName(): string {
    return (
      this.configService.get<string>('REFRESH_TOKEN_COOKIE_NAME') ??
      'ojaboy_refresh_token'
    );
  }

  private getRefreshCookieOptions(): CookieOptions {
    const ttlDays = Number(
      this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ?? 30,
    );

    return {
      httpOnly: true,
      secure:
        this.configService.get<string>('REFRESH_TOKEN_COOKIE_SECURE') ===
          'true' || this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge:
        (Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : 30) *
        24 *
        60 *
        60 *
        1000,
    };
  }
}
