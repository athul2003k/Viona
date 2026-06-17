// app/api/orders/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserRole, hasPermission } from '@/lib/auth';

export type Order = {
  id: string;
  orderDate: string;
  status: string;
  totalAmount: number;
  // Customer Information
  customer: {
    name: string;
    email: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  // Internal tracking
  placedBy: {
    id: string;
    email: string;
  };
  orderItems: {
    id: string;
    product: {
      id: string;
      name: string;
      sku: string;
    };
    quantity: number;
    priceAtOrder: number;
  }[];
  // Additional order info
  notes?: string;
  shippingMethod?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  
  if (!orgId) {
    console.log('Orders API: Missing orgId parameter');
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  console.log(`Orders API: Checking permissions for orgId: ${orgId}`);

  try {
    const role = await getUserRole(orgId);
    console.log(`Orders API: User role in org ${orgId}: ${role}`);
    
    if (!(await hasPermission(role, ['admin', 'manager', 'employee']))) {
      console.log(`Orders API: Permission denied for role: ${role}`);
      return NextResponse.json({ 
        error: 'Insufficient permissions',
        debug: { role, orgId, requiredRoles: ['reader', 'writer', 'read-write', 'admin'] }
      }, { status: 403 });
    }

    console.log('Orders API: Fetching from database (cache disabled)');

    const bigOrgId = BigInt(orgId);
    console.log(`Orders API: Fetching orders for org: ${bigOrgId}`);
    
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const search = url.searchParams.get('search') || '';
    const sortBy = url.searchParams.get('sortBy') || 'orderDate';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const statusFilter = url.searchParams.get('statusFilter') || 'all';
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    const where: any = { org_id: bigOrgId };

    if (search) {
      where.OR = [
        { customer_name: { contains: search, mode: 'insensitive' } },
        { customer_email: { contains: search, mode: 'insensitive' } },
        { customer_phone: { contains: search, mode: 'insensitive' } },
        {
          orderItems: {
            some: {
              product: {
                name: { contains: search, mode: 'insensitive' }
              }
            }
          }
        }
      ];
      if (!isNaN(Number(search))) {
        where.OR.push({ order_id: BigInt(search) });
      }
    }

    if (statusFilter !== 'all') {
      where.status = statusFilter;
    }

    if (dateFrom || dateTo) {
      where.order_date = {};
      if (dateFrom) where.order_date.gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.order_date.lte = toDate;
      }
    }

    let prismaOrderBy: any = { created_at: 'desc' };
    if (sortBy === 'orderDate' || sortBy === 'created_at') {
      prismaOrderBy = { order_date: sortOrder };
    } else if (sortBy === 'totalAmount') {
      prismaOrderBy = { total_amount: sortOrder };
    } else if (sortBy === 'status') {
      prismaOrderBy = { status: sortOrder };
    } else if (sortBy === 'id' || sortBy === 'order_id') {
      prismaOrderBy = { order_id: sortOrder };
    }

    const skip = (page - 1) * pageSize;

    const [total, orders] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: {
          orderItems: {
            include: { 
              product: { 
                select: { product_id: true, name: true, sku: true } 
              } 
            }
          },
          placedBy: { 
            select: { user_id: true, email: true } 
          },
        },
        orderBy: prismaOrderBy,
        skip,
        take: pageSize
      })
    ]);

    console.log(`Orders API: Found ${orders.length} orders from database (Total: ${total})`);

    const mappedOrders: Order[] = orders.map((o) => {
      // Type-safe access with fallbacks
      const orderData = o as any; // Temporary any cast to access potentially new fields
      
      return {
        id: o.order_id.toString(),
        orderDate: o.order_date?.toISOString() || new Date().toISOString(),
        status: o.status || 'pending',
        totalAmount: Number(o.total_amount || 0),
        customer: {
          name: orderData.customer_name || '',
          email: orderData.customer_email || '',
          phone: orderData.customer_phone || '',
          address: {
            street: orderData.shipping_street || '',
            city: orderData.shipping_city || '',
            state: orderData.shipping_state || '',
            zipCode: orderData.shipping_zip || '',
            country: orderData.shipping_country || 'USA',
          },
        },
        placedBy: {
          id: o.placedBy?.user_id.toString() || '',
          email: o.placedBy?.email || 'unknown',
        },
        orderItems: o.orderItems.map((item) => ({
          id: item.order_item_id.toString(),
          product: {
            id: item.product.product_id.toString(),
            name: item.product.name || '',
            sku: item.product.sku || '',
          },
          quantity: item.quantity || 0,
          priceAtOrder: Number(item.price_at_order || 0),
        })),
        notes: orderData.notes || '',
        shippingMethod: orderData.shipping_method || '',
        paymentMethod: orderData.payment_method || '',
        createdAt: o.created_at?.toISOString() || new Date().toISOString(),
        updatedAt: o.updated_at?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      data: mappedOrders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    }, {
      headers: {
        'X-Cache': 'DISABLED',
        'X-DB-Count': total.toString(),
      },
    });
    
  } catch (error) {
    console.error('Orders API error:', error);
    
    return NextResponse.json({ 
      error: 'Failed to fetch orders',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
