import jwt from "jsonwebtoken";

const DEFAULT_EXPIRY = "12h";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET environment variable");
  }
  return secret;
}

export function signAuthToken(payload, options = {}) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: DEFAULT_EXPIRY,
    ...options,
  });
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getSecret());
}
