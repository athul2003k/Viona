import { createApp } from "./app.js";
import { ENV } from "./config/env.js";
import { connectMongo } from "./config/mongo.js";
import { startRabbitMQConsumer } from "./rabbitmq/consumer.js";

const start = async () => {
  try {
    await connectMongo();
    await startRabbitMQConsumer();

    const app = createApp();

    app.listen(ENV.port as number, "0.0.0.0", () => {
      console.log(`🚀 Notification server running on port ${ENV.port}`);
    });
  } catch (err) {
    console.error("Failed to start notification server:", err);
    process.exit(1);
  }
};

start();
