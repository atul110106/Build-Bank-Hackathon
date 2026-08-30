import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-only-change-me-in-production") {
  console.warn("[securebank-api] WARNING: Set JWT_SECRET in production.");
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  return {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}
