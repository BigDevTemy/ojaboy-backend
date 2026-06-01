import { IsString, MinLength } from 'class-validator';

export class AskAgentChatboxDto {
  @IsString()
  @MinLength(1)
  question: string;
}
