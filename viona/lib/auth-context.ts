'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export type AuthContext = {
  clerkId: string;
  userId: bigint;
  email: string;
};

export async function getAuthContext(): Promise<AuthContext> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error('Unauthorized');

  // Single DB call
  let user = await prisma.user.findUnique({
    where: { clerk_id: clerkId },
    select: { user_id: true, email: true },
  });

  if (!user) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (!email) throw new Error('Email not found');

    user = await prisma.user.create({
      data: { clerk_id: clerkId, email },
      select: { user_id: true, email: true },
    });
  }

  return {
    clerkId,
    userId: user.user_id,
    email: user.email,
  };
}
