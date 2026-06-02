import { OAuth2Client } from "google-auth-library";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export async function verifyGoogleIdToken(
  idToken: string,
  clientIds: string[],
): Promise<GoogleProfile> {
  if (clientIds.length === 0) {
    throw new Error("Google OAuth is not configured");
  }

  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientIds,
  });

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google ID token");
  }

  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified");
  }

  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: true,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}
