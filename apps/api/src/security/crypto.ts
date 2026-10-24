import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "../env";
export function sign(value: string) {
  return createHmac("sha256", env.SESSION_SECRET)
    .update(value)
    .digest("base64url");
}
export function validSignature(value: string, signature: string) {
  const a = Buffer.from(sign(value)),
    b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function encrypt(value: string) {
  const key = Buffer.from(env.TOKEN_ENC_KEY, "base64");
  if (key.length !== 32)
    throw new Error("TOKEN_ENC_KEY must be 32 bytes encoded as base64.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}
export function decrypt(value: string) {
  const data = Buffer.from(value, "base64"),
    cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(env.TOKEN_ENC_KEY, "base64"),
      data.subarray(0, 12),
    );
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    cipher.update(data.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export function session(userId: string) {
  const value = Buffer.from(
    JSON.stringify({ userId, exp: Date.now() + 7 * 86400000 }),
  ).toString("base64url");
  return value + "." + sign(value);
}
export function parseSession(cookie?: string): string | undefined {
  if (!cookie) return;
  const [value, signature] = cookie.split(".");
  if (!value || !signature || !validSignature(value, signature)) return;
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString()) as {
      userId: string;
      exp: number;
    };
    if (data.exp > Date.now() && /^[a-f\d-]{36}$/.test(data.userId))
      return data.userId;
  } catch {
    /* Invalid cookies are unauthenticated. */
  }
}
