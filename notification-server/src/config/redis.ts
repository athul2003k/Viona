import { createClient } from "redis";
import { ENV } from "./env.js"

export const redis = createClient({ url:ENV.redisUrl});

export const connectRedis = async() => {
    await redis.connect();
    console.log("Connected to redis.");
};

