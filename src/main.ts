/**
 * Application entry point
 */

import { createApp } from './app';
import config from './config';
import { logger } from './config/logger';

async function bootstrap() {
  try {
    const app = createApp();

    app.listen(config.app.port, () => {
      logger.info(`Fulfillment service running on port ${config.app.port}`);
      logger.info(`Environment: ${config.app.env}`);
      logger.info(`API Documentation:`);
      logger.info(`  - Swagger UI: http://localhost:${config.app.port}/api-docs`);
      logger.info(`  - OpenAPI JSON: http://localhost:${config.app.port}/api-docs.json`);
      logger.info(`  - ReDoc: http://localhost:${config.app.port}/redoc`);
    });
  } catch (error) {
    logger.error('Failed to start application:', error as Error);
    process.exit(1);
  }
}

bootstrap();
