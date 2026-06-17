// import amqp, { Connection, Channel } from "amqplib";
import type { Connection, Channel } from "amqplib";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const amqp = require("amqplib");
import { ENV } from "../config/env.js";
import { createAndBroadcastNotification } from "../services/notification.service.js";

let connection: any = null;
let channel: any = null;
const QUEUE_NAME = ENV.notificationQueue;

export const startRabbitMQConsumer = async () => {
  try {
    console.log(`Connecting to RabbitMQ at ${ENV.rabbitmqUrl}...`);
    connection = await amqp.connect(ENV.rabbitmqUrl);

    connection.on("error", (err: any) => {
      console.error("RabbitMQ connection error:", err);
      // Optional: Implement reconnection logic here
    });

    connection.on("close", () => {
      console.warn("RabbitMQ connection closed");
    });

    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log(`✅ RabbitMQ Consumer connected & listening on ${QUEUE_NAME}`);

    channel.consume(QUEUE_NAME, async (msg: any) => {
      if (!msg) return;

      try {
        const content = msg.content.toString();
        const data = JSON.parse(content);
        console.log("📨 Received from RabbitMQ:", data);

        await createAndBroadcastNotification(data);

        channel?.ack(msg);
      } catch (err) {
        console.error("Error handling RabbitMQ message:", err);
        // If it's a persistent error, maybe nack without requeue, or dead letter
        // For now, we verify JSON parsing, if that fails we should ack to remove bad message or nack
        // channel?.nack(msg, false, false); 
      }
    });

  } catch (error) {
    console.error("Failed to start RabbitMQ consumer:", error);
    // Retry logic could go here
    setTimeout(startRabbitMQConsumer, 5000);
  }
};
