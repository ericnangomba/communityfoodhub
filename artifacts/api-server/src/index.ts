import app from "./app";
import { logger } from "./lib/logger";
import { ensureConfiguredSuperAdmin } from "./lib/auth";
import { ensureDatabaseSchema } from "@workspace/db";

const rawPort = process.env["PORT"] || "3000";

const port = Number(rawPort);

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

logger.info({
  hasSuperAdminEmail: Boolean(process.env.SUPER_ADMIN_EMAIL),
  hasSuperAdminPassword: Boolean(process.env.SUPER_ADMIN_PASSWORD),
}, "Super admin configuration loaded");

ensureDatabaseSchema()
  .then(() => ensureConfiguredSuperAdmin())
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
