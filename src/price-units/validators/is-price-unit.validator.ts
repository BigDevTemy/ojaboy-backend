import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PriceUnitsService } from '../price-units.service';

/**
 * Async class-validator constraint that checks a value against the active
 * price_units table. Requires `useContainer` to be wired in main.ts so Nest can
 * inject PriceUnitsService.
 */
@ValidatorConstraint({ name: 'isPriceUnit', async: true })
@Injectable()
export class IsPriceUnitConstraint implements ValidatorConstraintInterface {
  constructor(private readonly priceUnitsService: PriceUnitsService) {}

  async validate(value: unknown): Promise<boolean> {
    if (typeof value !== 'string' || value.length === 0) {
      return false;
    }
    return this.priceUnitsService.isValidCode(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid, active price unit code`;
  }
}

/** Validates that the decorated string is a known, active price unit code. */
export function IsPriceUnit(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsPriceUnitConstraint,
    });
  };
}
