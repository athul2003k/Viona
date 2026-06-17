import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { ensureOrganizationMember } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductStock = {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  imageUrl?: string;
};

type WarehouseDetail = {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  updatedAt: string;
  productStocks: ProductStock[];
  totalStock: number;
  productCount: number;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    await ensureOrganizationMember(orgId);
    const warehouseId = BigInt(id);
    const bigOrgId = BigInt(orgId);

    const warehouse = await prisma.warehouse.findFirst({
      where: {
        warehouse_id: warehouseId,
        org_id: bigOrgId,
      },
      include: {
        productStocks: {
          include: {
            product: {
              select: {
                product_id: true,
                name: true,
                sku: true,
                image_url: true,
              }
            }
          },
          orderBy: {
            quantity: 'desc'
          }
        }
      }
    });

    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const productStocks: ProductStock[] = warehouse.productStocks.map(stock => ({
      productId: stock.product.product_id.toString(),
      productName: stock.product.name || 'Unnamed Product',
      sku: stock.product.sku || 'N/A',
      quantity: stock.quantity || 0,
      imageUrl: stock.product.image_url || undefined,
    }));

    const totalStock = productStocks.reduce((sum, stock) => sum + stock.quantity, 0);

    const warehouseDetail: WarehouseDetail = {
      id: warehouse.warehouse_id.toString(),
      name: warehouse.name || 'Unnamed Warehouse',
      address: warehouse.address || 'No address',
      createdAt: warehouse.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: warehouse.updated_at?.toISOString() || new Date().toISOString(),
      productStocks,
      totalStock,
      productCount: productStocks.length,
    };

    return NextResponse.json(warehouseDetail);
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch warehouse' },
      { status: 500 }
    );
  }
}
