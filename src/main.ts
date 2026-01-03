/**
 * Application entry point
 */

import { createApp } from './app.js';
import config from './config/index.js';
import { logger } from './config/logger.js';
import { producer, consumer } from './kafka/index.js';
import { allHandlers } from './kafka/handlers.js';

async function bootstrap() {
  try {
    // Connect to Kafka
    try {
      await producer.connect();
      logger.info("Kafka producer connected");

      await consumer.connect();
      await consumer.subscribe(allHandlers);
      logger.info("Kafka consumer connected and subscribed", {
        topics: allHandlers.map((h) => h.topicName),
      });
    } catch (error) {
      logger.error(
        "Failed to connect to Kafka",
        error instanceof Error ? error : new Error(String(error))
      );
      // Continue without Kafka - service can still handle HTTP requests
    }

    const app = createApp();

    const server = app.listen(config.app.port, () => {
      logger.info(`Fulfillment service running on port ${config.app.port}`);
      logger.info(`Environment: ${config.app.env}`);
      logger.info(`API Documentation:`);
      logger.info(`  - Swagger UI: http://localhost:${config.app.port}/api-docs`);
      logger.info(`  - OpenAPI JSON: http://localhost:${config.app.port}/api-docs.json`);
      logger.info(`  - ReDoc: http://localhost:${config.app.port}/redoc`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      server.close(async () => {
        logger.info("HTTP server closed");
        
        try {
          await consumer.disconnect();
          await producer.disconnect();
          logger.info("Kafka connections closed");
        } catch (error) {
          logger.error(
            "Error during Kafka cleanup",
            error instanceof Error ? error : new Error(String(error))
          );
        }
        
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.warn("Forced shutdown due to timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error('Failed to start application:', error as Error);
    process.exit(1);
  }
}

bootstrap();
