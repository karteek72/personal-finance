import { SignJWT, jwtVerify } from "jose";

const ACCESS_TTL = "24h";
const REFRESH_TTL = "30d";

function getSecret(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

export type AccessTokenPayload = {
  sub: string;
  typ: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  typ: "refresh";
};

export async function signAccessToken(
  userId: string,
  jwtSecret: string,
): Promise<string> {
  return new SignJWT({ typ: "access" satisfies AccessTokenPayload["typ"] })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getSecret(jwtSecret));
}

export async function signRefreshToken(
  userId: string,
  jwtSecret: string,
): Promise<string> {
  return new SignJWT({ typ: "refresh" satisfies RefreshTokenPayload["typ"] })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(getSecret(jwtSecret));
}

export async function verifyAccessToken(
  token: string,
  jwtSecret: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(jwtSecret), {
    algorithms: ["HS256"],
  });
  if (payload.typ !== "access" || typeof payload.sub !== "string") {
    throw new Error("Invalid access token");
  }
  return { sub: payload.sub, typ: "access" };
}

export async function verifyRefreshToken(
  token: string,
  jwtSecret: string,
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(jwtSecret), {
    algorithms: ["HS256"],
  });
  if (payload.typ !== "refresh" || typeof payload.sub !== "string") {
    throw new Error("Invalid refresh token");
  }
  return { sub: payload.sub, typ: "refresh" };
}
