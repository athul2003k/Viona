import dotenv from "dotenv";

dotenv.config();

export const ENV = {
    port: process.env.PORT || 5001,
    mongoUrl: process.env.MONGO_URL!,
    redisUrl: process.env.REDIS_URL!,
    rabbitmqUrl: process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672",
    notificationQueue: process.env.RABBITMQ_NOTIFICATION_QUEUE || "send_notification"
};