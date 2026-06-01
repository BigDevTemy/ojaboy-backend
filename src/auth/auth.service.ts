import {
  ConflictException,
  InternalServerErrorException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ForgetPasswordDto } from './dto/forget-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthUser, JwtPayload } from './interfaces/auth-user.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.toLowerCase();

    if (await this.findStoredUserByEmail(email)) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: registerDto.fullName.trim(),
        passwordHash: await hash(registerDto.password, 12),
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

    if (!user || !(await compare(loginDto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

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
    };
  }
}
