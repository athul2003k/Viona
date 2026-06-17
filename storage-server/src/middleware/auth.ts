import type { Request, Response, NextFunction } from "express";
import { createClerkClient, verifyToken } from "@clerk/express";
import { syncUserFromClerk } from "../services/clerk.service";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
});

export async function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    // Verify the JWT token using Clerk's verifyToken
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get user details from Clerk using the user ID from the token
    const clerkUser = await clerkClient.users.getUser(payload.sub);

    // Ensure user exists in DB
    const user = await syncUserFromClerk({
      sub: payload.sub,
      email: clerkUser.emailAddresses[0]?.emailAddress,
    });

    req.user = {
      id: user.id,
      email: user.email,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
