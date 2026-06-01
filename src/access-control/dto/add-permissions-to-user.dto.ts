import {
  ArrayNotEmpty,
  IsArray,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class AddPermissionsToUserDto {
  @IsUUID()
  userId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MinLength(2, { each: true })
  permissions: string[];
}
