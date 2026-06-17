'use server';

import { getUserRole } from '@/lib/auth';

export async function getOrderRole(orgId: string) {
  const role = await getUserRole(orgId);
  return role;
}
