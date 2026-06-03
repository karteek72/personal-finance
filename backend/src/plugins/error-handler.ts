import type { FastifyPluginAsync } from "fastify";
import { ZodError } from "zod";
import { AppError, isAppError } from "../lib/errors.js";

export const errorHandlerPlugin: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, request, reply) => {
    if (reply.sent) {
      request.log.error({ err: error }, "error after response sent");
      return;
    }

    if (error instanceof ZodError) {
      request.log.warn(
        { err: error, issues: error.flatten() },
        "validation failed",
      );
      return reply.status(400).send(
        new AppError("VALIDATION_ERROR", 400, "Invalid request", {
          details: error.flatten().fieldErrors,
        }).toJSON(),
      );
    }

    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, code: error.code }, error.message);
      } else {
        request.log.warn({ err: error, code: error.code }, error.message);
      }

      return reply.status(error.statusCode).send(error.toJSON());
    }

    request.log.error({ err: error }, "unhandled error");
    const internal = AppError.internal(error);
    return reply.status(500).send(internal.toJSON());
  });

  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ method: request.method, url: request.url }, "not found");
    return reply.status(404).send(AppError.notFound("Route not found").toJSON());
  });
};
