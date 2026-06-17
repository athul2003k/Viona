import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const ws = await prisma.workflow.findMany({ select: { id: true, name: true, status: true, org_id: true } });
  const byOrg: Record<string, { active: number, draft: number }> = {};
  for (const w of ws) {
    const orgId = w.org_id.toString();
    if (!byOrg[orgId]) byOrg[orgId] = { active: 0, draft: 0 };
    if (w.status === 'active') byOrg[orgId].active++;
    else byOrg[orgId].draft++;
  }
  console.log('Workflows By Org:', JSON.stringify(byOrg, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
