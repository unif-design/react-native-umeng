import { UmengError } from '../UmengError';

export function invalidInput(message: string): never {
  throw new UmengError({ reason: 'invalid_input', message });
}

export function requireObject(
  value: unknown,
  field: string
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return invalidInput(`${field} must be an object`);
  return value as Record<string, unknown>;
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    return invalidInput(`${field} must be a non-empty string`);
  return value;
}
