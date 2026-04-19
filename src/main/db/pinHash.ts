import { randomBytes, pbkdf2Sync, timingSafeEqual } from "crypto";

function hashPin(pin: string, salt: Buffer): string {
  return pbkdf2Sync(pin, salt, 310000, 32, "sha256").toString("hex");
}

export function createPinHash(pin: string): string {
  const salt = randomBytes(16);
  return salt.toString("hex") + ":" + hashPin(pin, salt);
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) {
    return false;
  }
  const [saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const computed = Buffer.from(hashPin(pin, salt), "hex");
    const expected = Buffer.from(hashHex, "hex");
    if (computed.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}
