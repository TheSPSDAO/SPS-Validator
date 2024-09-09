/**
 * Copied from https://github.com/Microsoft/TypeScript/issues/26362#issuecomment-476018475
 * Copyright (c) 2019 Jeff Lau (UselessPickles) https://github.com/UselessPickles
 * Licensed under Apache-2.0 license, same as TypeScript
 *
 * Use StrictNumericEnumParam to define the type of a function
 * parameter that should be strictly assignable to a numeric enum
 * type. This prevents arbitrary numbers from being passed in to
 * the parameter, working around TypeScript's intentional decision
 * to allow type `number` to be assignable to all numeric enum types.
 *
 * Instead of writing a function signature as:
 *     function doSomething(value: MyEnum): void;
 *
 * Write it like this:
 *     function doSomething<Value extends MyEnum>(
 *         value: StrictNumericEnumParam<MyEnum, Value>
 *     ): void;
 *
 * StrictNumericEnumParam<MyEnum, Value> will evaluate to `never`
 * for any type `Value` that is not strictly assignable to `MyEnum`
 * (e.g., type `number`, or any number literal type that is not one
 * of the valid values for `MyEnum`), and will produce a compiler
 * error such as:
 *     "Argument of type `number` is not assignable to parameter of type `never`"
 *
 * LIMITATION:
 * This only works for a special subset of numeric enums that are considered
 * "Union Enums". For an enum to be compatible, it basically must be a simple
 * numeric enum where every member has either an inferred value
 * (previous enum member + 1), or a number literal (1, 42, -3, etc.)
 *
 * If the `Enum` type argument is not a "Union Enum", then this type resolves
 * to simply type `Enum` and the use of StrictNumericEnumParam is neither
 * beneficial nor detrimental.
 */
export type StrictNumericEnumParam<Enum extends number, Param extends Enum> = true extends ({ [key: number]: false } & { [P in Enum]: true })[Enum]
    ? true extends ({ [key: number]: false } & { [P in Enum]: true })[Param]
        ? Param
        : never
    : Enum;
