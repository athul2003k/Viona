// app/api/inventory/products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { getUserRole, hasPermission } from '@/lib/auth';

export type Product = {
  id: string;
  name: string;
  sku: string;
  description?: string;
  stock: number;
  price: number;
  image: string | null;
  createdAt: string;
  updatedAt: string;
  warehouseId?: string; 
  categoryId?: string;
};

/**
 * Fetches products from database with optimized query
 * Note: This is NOT cached to ensure instant updates
 */
async function getProducts(orgId: string, searchParams: URLSearchParams) {
  const bigOrgId = BigInt(orgId);
  
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '20');
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'name';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const stockFilter = searchParams.get('stockFilter') || 'all';

  // Build WHERE clause
  const where: any = {
    org_id: bigOrgId,
    status: { not: 'deleted' },
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Stock filtering
  if (stockFilter !== 'all') {
    if (stockFilter === 'outOfStock') {
      where.productStocks = { none: { quantity: { gt: 0 } } };
    } else if (stockFilter === 'inStock') {
      where.productStocks = { some: { quantity: { gte: 10 } } };
    } else if (stockFilter === 'lowStock') {
      where.productStocks = {
        some: { quantity: { gt: 0, lt: 10 } },
      };
    }
  }

  // Build ORDER BY clause
  let orderBy: any = { created_at: 'desc' };
  
  if (sortBy === 'name') orderBy = { name: sortOrder };
  else if (sortBy === 'sku') orderBy = { sku: sortOrder };
  else if (sortBy === 'createdAt') orderBy = { created_at: sortOrder };
  else if (sortBy === 'updatedAt') orderBy = { updated_at: sortOrder };
  // Note: sorting by computed fields like 'stock' or 'price' directly via Prisma
  // across relations is complex. For now we will sort by creation date as fallback
  // if stock/price is requested, since they are aggregated from relations.

  const skip = (page - 1) * pageSize;

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        product_id: true,
        name: true,
        sku: true,
        description: true,
        image_url: true,
        created_at: true,
        updated_at: true,
        productStocks: {
          select: { quantity: true },
        },
        productPrices: {
          where: { valid_to: null },
          select: { retail_price: true },
          orderBy: { valid_from: 'desc' },
          take: 1,
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
  ]);

  const mappedData = products.map((p) => ({
    id: p.product_id.toString(),
    name: p.name || '',
    sku: p.sku || '',
    description: p.description || '',
    stock: p.productStocks.reduce((acc, s) => acc + (s.quantity || 0), 0),
    price: p.productPrices[0]?.retail_price?.toNumber() || 0,
    image: p.image_url,
    createdAt: p.created_at?.toISOString() || new Date().toISOString(),
    updatedAt: p.updated_at?.toISOString() || new Date().toISOString(),
    // Note: Category and Warehouse associations for the table are simplified
    categoryId: undefined, 
    warehouseId: undefined,
  }));

  // If user sorted by stock or price, do it in memory for the current page
  if (sortBy === 'stock' || sortBy === 'price') {
    mappedData.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = (aVal as number) - (bVal as number);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  return {
    data: mappedData,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - Please sign in' },
        { 
          status: 401,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // Get organization ID from query params
    const searchParams = request.nextUrl.searchParams;
    const orgId = searchParams.get('orgId');
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { 
          status: 400,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // Check permissions (NOT cached - always fresh check)
    const role = await getUserRole(orgId);
    
    if (!(await hasPermission(role, ['admin', 'manager', 'employee']))) {
      return NextResponse.json(
        { 
          error: 'Insufficient permissions to view products',
          role 
        },
        { 
          status: 403,
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // Fetch products (NOT cached - always fresh data)
    const result = await getProducts(orgId, searchParams);

    // Return with aggressive no-cache headers for instant updates
    return NextResponse.json(result, {
      status: 200,
      headers: {
        // Prevent ALL caching for instant updates
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
        // Metadata
        'X-Products-Count': result.data.length.toString(),
        'X-Total-Count': result.total.toString(),
        'X-Organization-Id': orgId,
      },
    });
  } catch (error) {
    console.error('Products API error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                              errorMessage.toLowerCase().includes('unauthorized');
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { 
        status: isPermissionError ? 403 : 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  }
}

// CRITICAL: Force dynamic rendering - never static
export const dynamic = 'force-dynamic';

// CRITICAL: Disable all caching at the route level
export const revalidate = 0;

// Ensure route is not cached by Vercel/CDN
export const fetchCache = 'force-no-store';
