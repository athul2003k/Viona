import { StorageUser } from "../models/StorageUser.model";

export async function syncUserFromClerk(payload: {
  sub: string;
  email?: string;
}) {
  const clerkUserId = payload.sub;
  const email = payload.email;

  if (!clerkUserId || !email) {
    throw new Error("Invalid Clerk token payload");
  }

  // Check if user already exists
  const existingUser = await StorageUser.findById(clerkUserId);

  if (existingUser) {
    return { id: existingUser._id as string, email: existingUser.email };
  }

  // Create user if not found
  const newUser = await StorageUser.create({
    _id: clerkUserId,
    email,
  });

  return { id: newUser._id as string, email: newUser.email };
}
