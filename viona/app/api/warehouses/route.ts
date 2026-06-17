// app/api/warehouses/route.ts

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { ensureOrganizationMember } from "@/lib/auth";
import { unstable_cache } from "next/cache";

/* ---------------------------------------------
 Types
--------------------------------------------- */

export type Warehouse = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  productCount: number;
  totalStock: number;
  isDefault?: boolean;
};

/* ---------------------------------------------
 Cached Warehouse Fetcher
 NOTE:
 - Cache key is STATIC
 - Function arguments are automatically included
--------------------------------------------- */

const getCachedWarehouses = unstable_cache(
  async (orgId: string): Promise<Warehouse[]> => {
    const bigOrgId = BigInt(orgId);

    const warehouses = await prisma.warehouse.findMany({
      where: { org_id: bigOrgId },
      include: {
        productStocks: {
          select: {
            quantity: true,
          },
        },
        _count: {
          select: { productStocks: true },
        },
      },
      orderBy: { created_at: "asc" },
    });

    return warehouses.map((warehouse, index) => {
      const totalStock = warehouse.productStocks.reduce(
        (sum, stock) => sum + (stock.quantity ?? 0),
        0
      );

      return {
        id: warehouse.warehouse_id.toString(),
        name: warehouse.name ?? "Unnamed Warehouse",
        address: warehouse.address ?? "No address",
        createdAt: warehouse.created_at?.toISOString() ?? new Date().toISOString(),
        updatedAt: warehouse.updated_at?.toISOString() ?? new Date().toISOString(),
        productCount: warehouse._count.productStocks,
        totalStock,
        isDefault: index === 0,
      };
    });
  },

  // ✅ STATIC namespace (args are auto-included)
  ["warehouses"],

  {
    revalidate: 300, // 5 minutes
    tags: ["warehouses"], // used by revalidateTag()
  }
);

/* ---------------------------------------------
 API Route
--------------------------------------------- */

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID required" },
        { status: 400 }
      );
    }

    await ensureOrganizationMember(orgId);

    // ✅ Cached, org-isolated fetch
    const warehouses = await getCachedWarehouses(orgId);

    // ❗ Never HTTP-cache API routes
    return NextResponse.json(warehouses, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error fetching warehouses:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch warehouses",
      },
      { status: 500 }
    );
  }
}
