'use server';

import prisma from '@/lib/prisma';

export type OrgAccess = {
  role: string;
  isAdmin: boolean;
};

export async function getOrgAccess(
  orgId: bigint,
  userId: bigint
): Promise<OrgAccess> {
  const member = await prisma.organizationMember.findUnique({
    where: {
      org_id_user_id: { org_id: orgId, user_id: userId },
    },
    select: { role: true },
  });

  if (!member) {
    throw new Error('Access denied: not a member');
  }

  return {
    role: member.role,
    isAdmin: member.role === 'admin',
  };
}
