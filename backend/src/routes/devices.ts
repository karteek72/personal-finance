import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireRequestUser } from "../lib/auth-http.js";
import {
  deleteDeviceToken,
  registerDeviceToken,
} from "../services/device-tokens.js";

const registerBody = z.object({
  token: z.string().min(16).max(512),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export const deviceRoutes: FastifyPluginAsync = async (app) => {
  app.post("/devices/register", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const body = registerBody.parse(request.body);
    await registerDeviceToken(user.id, body.token, body.platform ?? "ios");
    return { ok: true };
  });

  app.delete("/devices/:deviceId", async (request) => {
    const user = await requireRequestUser(request, app.config.env);
    const { deviceId } = request.params as { deviceId: string };
    const removed = await deleteDeviceToken(user.id, deviceId);
    if (!removed) {
      throw AppError.notFound("Device token not found");
    }
    return { id: deviceId };
  });
};
