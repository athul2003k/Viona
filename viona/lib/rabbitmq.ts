const amqp = require("amqplib");

if (typeof window !== "undefined") {
  throw new Error("RabbitMQ producer must not run in browser!");
}

let connection: any = null;
let channel: any = null;
let isConnecting = false;

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const QUEUE_NAME = "send_notification";

const connect = async () => {
  if (connection && channel) return { connection, channel };
  if (isConnecting) {
    // Simple retry wait if already connecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (connection && channel) return { connection, channel };
    throw new Error("Already connecting to RabbitMQ");
  }

  isConnecting = true;
  try {
    console.log(`Connecting to RabbitMQ at ${RABBITMQ_URL}...`);
    connection = await amqp.connect(RABBITMQ_URL);

    connection.on("error", (err:any) => {
      console.error("RabbitMQ connection error:", err);
      connection = null;
      channel = null;
    });

    connection.on("close", () => {
      console.warn("RabbitMQ connection closed");
      connection = null;
      channel = null;
    });

    channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    console.log("✅ RabbitMQ Connected & Queue Asserted");
    return { connection, channel };
  } catch (error) {
    console.error("Failed to connect to RabbitMQ:", error);
    connection = null;
    channel = null;
    throw error;
  } finally {
    isConnecting = false;
  }
};

export const sendNotification = async (payload: any) => {
  try {
    const { channel } = await connect();

    if (!channel) {
      throw new Error("RabbitMQ channel not available");
    }

    const sent = channel.sendToQueue(
      QUEUE_NAME,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );

    if (sent) {
      console.log("Notification sent to RabbitMQ:", payload.title);
    } else {
      console.warn("Notification buffer full, message may be delayed");
    }
  } catch (err) {
    console.error("Failed to send notification via RabbitMQ:", err);
  }
};
