import { IsEmail } from 'class-validator';

export class RetryOrderPaymentDto {
  @IsEmail()
  email: string;
}
