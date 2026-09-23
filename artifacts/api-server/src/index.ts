import app from "./app";
import { logger } from "./lib/logger";
import { ensureConfiguredSuperAdmin } from "./lib/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

logger.info({
  hasSuperAdminEmail: Boolean(process.env.SUPER_ADMIN_EMAIL),
  hasSuperAdminPassword: Boolean(process.env.SUPER_ADMIN_PASSWORD),
}, "Super admin configuration loaded");

ensureConfiguredSuperAdmin()
  .catch((error) => logger.error({ error }, "Unable to initialize the configured super admin"))
  .finally(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  });
