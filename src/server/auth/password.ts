import "server-only";
import bcrypt from "bcryptjs";

// bcrypt work factor: 2^12 rounds (~250 ms per hash in pure JS). Slow on
// purpose so a leaked hash is expensive to brute-force.
const COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
