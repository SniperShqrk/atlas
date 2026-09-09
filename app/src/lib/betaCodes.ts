/**
 * Offline-verifiable "beta code" for handing Pro access to testers without a
 * backend, an account system, or real IAP — a code is valid exactly when its
 * 8th digit is the checksum of the first 7 (see checksumDigit). There is no
 * server-side list, so any valid code can be redeemed by anyone who has it
 * and can be reused indefinitely; that's a deliberate tradeoff for handing
 * codes to a small trusted beta group, not a security boundary. Generate
 * codes to hand out with `npx tsx tools/generate-beta-codes.ts`.
 */

const SALT = 4271;

function checksumDigit(sevenDigits: string): number {
  let sum = SALT;
  for (let i = 0; i < sevenDigits.length; i++) {
    sum += (sevenDigits.charCodeAt(i) - 48 + 1) * (i * 2 + 3);
  }
  return sum % 10;
}

export function generateBetaCode(): string {
  const body = Array.from({ length: 7 }, () => Math.floor(Math.random() * 10)).join('');
  return body + checksumDigit(body);
}

export function isValidBetaCode(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 8) return false;
  return checksumDigit(digits.slice(0, 7)) === Number(digits[7]);
}
