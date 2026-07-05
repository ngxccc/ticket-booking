import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";
import equal from "fast-deep-equal/es6";

@ValidatorConstraint({ name: "Match" })
export class MatchConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints as (string | undefined)[];
    if (!relatedPropertyName) {
      return false;
    }
    const relatedValue = (args.object as Record<string, unknown>)[
      relatedPropertyName
    ];

    // Always execute O(1) Reference Check first.
    // If they share the same memory reference or are identical primitives,
    // we bypass the expensive O(N) tree traversal entirely.
    if (value === relatedValue) return true;

    return equal(value, relatedValue);
  }

  defaultMessage(args: ValidationArguments): string {
    const targetProperty = String(args.constraints[0] ?? "unknown");
    return `${args.property} must match ${targetProperty}`;
  }
}

export function Match(property: string, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: MatchConstraint,
    });
  };
}
