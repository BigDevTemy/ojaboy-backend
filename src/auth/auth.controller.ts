import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ForgetPasswordDto } from './dto/forget-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOrderOtpDto } from './dto/request-order-otp.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { VerifyOrderOtpDto } from './dto/verify-order-otp.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './interfaces/auth-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google')
  googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authService.googleLogin(googleLoginDto);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forget-password')
  forgetPassword(@Body() forgetPasswordDto: ForgetPasswordDto) {
    return this.authService.forgetPassword(forgetPasswordDto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('set-password')
  setPassword(@Body() setPasswordDto: SetPasswordDto) {
    return this.authService.setPassword(setPasswordDto);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('order-otp/request')
  requestOrderOtp(@Body() dto: RequestOrderOtpDto) {
    return this.authService.requestOrderOtp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('order-otp/verify')
  verifyOrderOtp(@Body() dto: VerifyOrderOtpDto) {
    return this.authService.verifyOrderOtp(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return user;
  }
}
