//app/inventory/actions.ts
"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserRole, hasPermission, ensureOrganizationMember } from "@/lib/auth";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { CacheService } from "@/lib/cache";
import { sendNotification } from "@/lib/rabbitmq";
import { emitInventoryEvent } from "@/lib/workflow-events";
import type { Product } from "../../api/inventory/products/route";

function toBigInt(id: string) {
  try {
    return BigInt(id);
  } catch {
    throw new Error("Invalid ID format");
  }
}

async function requireAuth() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

async function requireRole(orgId: string, perms: string[]) {
  const userId = await requireAuth();
  await ensureOrganizationMember(orgId);
  const role = await getUserRole(orgId);

  if (!await hasPermission(role, perms)) {
    throw new Error("Insufficient permissions");
  }

  return userId;
}

// Notify a list of users (removes duplicate code)
async function notifyMany(userIds: string[], payload: any) {
  await Promise.all(
    userIds.map((id) => sendNotification({ ...payload, userId: id }))
  );
}

// -----------------------------------------
// Cached Queries
// -----------------------------------------

const TAGS = {
  PRODUCT: "product",
  WAREHOUSE: "warehouse",
  ORDERS: "orders",
} as const;

const REVAL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 900,
} as const;

// PRODUCT DETAILS
const getCachedProductDetails = unstable_cache(
  async (orgId: string, productId: string) => {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);

    const product = await prisma.product.findFirst({
      where: { product_id: bigPid, org_id: bigOrgId },
      select: {
        product_id: true,
        name: true,
        sku: true,
        description: true,
        image_url: true,
        status: true,
        created_at: true,
        updated_at: true,
        createdBy: { select: { user_id: true, email: true } },
        modifiedBy: { select: { user_id: true, email: true } },
        productStocks: {
          where: { quantity: { gt: 0 } },
          select: {
            quantity: true,
            warehouse: { select: { warehouse_id: true, name: true, address: true } },
          },
        },
        productPrices: {
          orderBy: { valid_from: "desc" },
          take: 10,
          select: {
            price_id: true,
            retail_price: true,
            actual_price: true,
            market_price: true,
            valid_from: true,
            valid_to: true,
          },
        },
      },
    });

    if (!product) throw new Error("Product not found");

    // Faster separate query for orders
    const recentOrders = await prisma.orderItem.findMany({
      where: { product_id: bigPid, order: { org_id: bigOrgId } },
      select: {
        quantity: true,
        price_at_order: true,
        order: {
          select: { order_id: true, order_date: true, customer_name: true, status: true },
        },
      },
      orderBy: { order: { order_date: "desc" } },
      take: 5,
    });

    const totalStock = product.productStocks.reduce((a, s) => a + (s.quantity || 0), 0);
    const currentPrice = Number(product.productPrices[0]?.retail_price || 0);

    return {
      id: product.product_id.toString(),
      name: product.name || "",
      sku: product.sku || "",
      description: product.description || "",
      image: product.image_url || "",
      status: product.status || "active",
      createdAt: product.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: product.updated_at?.toISOString() || new Date().toISOString(),
      createdBy: {
        id: product.createdBy?.user_id.toString() || "",
        email: product.createdBy?.email || "Unknown",
      },
      modifiedBy: product.modifiedBy
        ? {
          id: product.modifiedBy.user_id.toString(),
          email: product.modifiedBy.email,
        }
        : null,
      warehouses: product.productStocks.map((ps) => ({
        id: ps.warehouse.warehouse_id.toString(),
        name: ps.warehouse.name,
        address: ps.warehouse.address || "",
        stock: ps.quantity || 0,
      })),
      priceHistory: product.productPrices.map((pp) => ({
        id: pp.price_id.toString(),
        retailPrice: Number(pp.retail_price || 0),
        actualPrice: pp.actual_price ? Number(pp.actual_price) : undefined,
        marketPrice: pp.market_price ? Number(pp.market_price) : undefined,
        validFrom: pp.valid_from?.toISOString() || new Date().toISOString(),
        validTo: pp.valid_to?.toISOString() || undefined,
      })),
      recentOrders: recentOrders.map((oi) => ({
        orderId: oi.order.order_id.toString(),
        orderDate: oi.order.order_date?.toISOString() || new Date().toISOString(),
        customerName: oi.order.customer_name || "Unknown Customer",
        quantity: oi.quantity || 0,
        priceAtOrder: Number(oi.price_at_order || 0),
        status: oi.order.status || "pending",
      })),
      totalStock,
      currentPrice,
      currentActualPrice: product.productPrices[0]?.actual_price
        ? Number(product.productPrices[0].actual_price)
        : undefined,
      currentMarketPrice: product.productPrices[0]?.market_price
        ? Number(product.productPrices[0].market_price)
        : undefined,
      lowStockThreshold: 10,
    };
  },
  ["product-details"],
  { tags: [TAGS.PRODUCT], revalidate: REVAL.MEDIUM }
);

// WAREHOUSE LIST
const getCachedWarehouseList = unstable_cache(
  async (orgId: string) => {
    const bigOrgId = toBigInt(orgId);

    const rows = await prisma.warehouse.findMany({
      where: { org_id: bigOrgId },
      select: { warehouse_id: true, name: true, address: true },
      orderBy: { name: "asc" },
    });

    return rows.map((w) => ({
      id: w.warehouse_id.toString(),
      name: w.name || "Unnamed Warehouse",
      address: w.address || "",
    }));
  },
  ["warehouse-list"],
  { tags: [TAGS.WAREHOUSE], revalidate: REVAL.LONG }
);

// -----------------------------------------
// Core Logic (Only Optimized Hotspots)
// -----------------------------------------

async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({
    where: { clerk_id: userId },
    select: { user_id: true, email: true, clerk_id: true },
  });

  if (!user) {
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses[0]?.emailAddress;
    if (!email) throw new Error("Unable to get user email from Clerk");

    user = await prisma.user.create({
      data: { clerk_id: userId, email },
      select: { user_id: true, email: true, clerk_id: true },
    });
  }

  return user;
}

async function getOrCreateDefaultWarehouse(orgId: bigint) {
  let warehouse = await prisma.warehouse.findFirst({
    where: { org_id: Number(orgId) },
    select: { warehouse_id: true, name: true },
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        org_id: Number(orgId),
        name: "Default Warehouse",
        address: "Default Address",
      },
      select: { warehouse_id: true, name: true },
    });
  }

  return warehouse;
}

// -----------------------------------------
// ✔️ OPTIMIZED AREA: CLEANER CACHE INVALIDATION
// -----------------------------------------

async function invalidateInventory(orgId: string, productId?: string) {
  await Promise.all([
    CacheService.invalidateProducts(orgId),
    revalidateTag(`org-products-${orgId}`),
    productId ? revalidateTag(`product-${productId}`) : null,
    revalidatePath("/inventory"),
    productId ? revalidatePath(`/inventory/${productId}`) : null,
  ]);
}

// -----------------------------------------
// Actions (optimized but same behavior)
// -----------------------------------------

export async function addProduct(
  orgId: string,
  productData: {
    name: string;
    sku: string;
    stock: number;
    price: number;
    image?: string | null;
    description?: string;
    warehouseId?: string;
  }
) {
  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const user = await getOrCreateUser(userId);

    // Use the user-selected warehouse if provided, otherwise fall back to default
    let warehouse;
    if (productData.warehouseId) {
      const selectedWarehouse = await prisma.warehouse.findFirst({
        where: { warehouse_id: toBigInt(productData.warehouseId), org_id: bigOrgId },
        select: { warehouse_id: true, name: true },
      });
      if (!selectedWarehouse) {
        throw new Error('Selected warehouse not found in this organization');
      }
      warehouse = selectedWarehouse;
    } else {
      warehouse = await getOrCreateDefaultWarehouse(bigOrgId);
    }

    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true },
    });

    const product = await prisma.$transaction(async (tx) => {
      const newProduct = await tx.product.create({
        data: {
          org_id: bigOrgId,
          name: productData.name,
          sku: productData.sku,
          description: productData.description || null,
          image_url: productData.image || null,
          status: "active",
          created_by: user.user_id,
          modified_by: user.user_id,
        },
        select: { product_id: true, name: true, sku: true },
      });

      await tx.productStock.create({
        data: {
          product_id: newProduct.product_id,
          warehouse_id: warehouse.warehouse_id,
          quantity: productData.stock,
        },
      });

      await tx.productPrice.create({
        data: {
          product_id: newProduct.product_id,
          retail_price: productData.price,
          valid_from: new Date(),
        },
      });

      return newProduct;
    });

    // Creator notification
    await sendNotification({
      userId: user.clerk_id,
      title: "Product Added",
      message: `Product "${product.name}" (SKU: ${product.sku}) has been added to inventory`,
      type: "system",
      priority: "MEDIUM",
      link: `/inventory/${product.product_id}`,
    });

    // Managers/admins notification
    const orgManagers = await prisma.organizationMember.findMany({
      where: {
        org_id: bigOrgId,
        role: { in: ["admin", "manager"] },
        user: { clerk_id: { not: userId } },
      },
      include: { user: { select: { clerk_id: true } } },
    });

    await notifyMany(
      orgManagers.map((m) => m.user.clerk_id),
      {
        title: "New Product Added",
        message: `"${product.name}" (SKU: ${product.sku}) was added to "${org?.name}" inventory`,
        type: "system",
        priority: "LOW",
        link: `/inventory/${product.product_id}`,
      }
    );

    await invalidateInventory(orgId, product.product_id.toString());

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "create", "Product", product).catch(() => { });

    console.log(`✅ Product created: ${product.product_id} (${product.name})`);

    return {
      success: true,
      productId: product.product_id.toString(),
      message: `Product "${product.name}" added successfully`,
    };
  } catch (error) {
    console.error("Error adding product:", error);

    if (error instanceof Error) {
      if (error.message.includes("unique_sku_per_organization")) {
        throw new Error(`SKU "${productData.sku}" already exists in this organization`);
      }
      throw error;
    }

    throw new Error("Failed to add product. Please try again.");
  }
}

export async function updateProduct(
  orgId: string,
  productId: string,
  productData: {
    name: string;
    sku: string;
    stock: number;
    price: number;
    image?: string | null;
    description?: string;
  }
) {
  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);
    const user = await getOrCreateUser(userId);

    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true },
    });

    const product = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findFirst({
        where: { product_id: bigPid, org_id: bigOrgId },
        select: { product_id: true, name: true },
      });

      if (!existing) {
        throw new Error("Product not found in this organization");
      }

      const oldName = existing.name;

      const updated = await tx.product.update({
        where: { product_id: bigPid },
        data: {
          name: productData.name,
          sku: productData.sku,
          description: productData.description || null,
          image_url: productData.image || null,
          modified_by: user.user_id,
          updated_at: new Date(),
        },
        select: { name: true, product_id: true, sku: true },
      });

      const stockEntry = await tx.productStock.findFirst({
        where: { product_id: bigPid },
        select: { stock_id: true },
      });

      if (stockEntry) {
        await tx.productStock.update({
          where: { stock_id: stockEntry.stock_id },
          data: { quantity: productData.stock },
        });
      }

      await tx.productPrice.updateMany({
        where: { product_id: bigPid, valid_to: null },
        data: { valid_to: new Date() },
      });

      await tx.productPrice.create({
        data: {
          product_id: bigPid,
          retail_price: productData.price,
          valid_from: new Date(),
        },
      });

      return { ...updated, oldName };
    });

    await sendNotification({
      userId: user.clerk_id,
      title: "Product Updated",
      message: `Product "${product.name}" has been updated in inventory`,
      type: "system",
      priority: "MEDIUM",
      link: `/inventory/${orgId}`,
    });

    if (product.oldName !== product.name) {
      const orgManagers = await prisma.organizationMember.findMany({
        where: {
          org_id: bigOrgId,
          role: { in: ["admin", "manager"] },
          user: { clerk_id: { not: userId } },
        },
        include: { user: { select: { clerk_id: true } } },
      });

      await notifyMany(
        orgManagers.map((m) => m.user.clerk_id),
        {
          title: "Product Updated",
          message: `"${product.oldName}" renamed to "${product.name}" in "${org?.name}"`,
          type: "system",
          priority: "LOW",
          link: `/inventory/${orgId}`,
        }
      );
    }

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "Product", product).catch(() => { });

    console.log(`✅ Product updated: ${productId} (${product.name})`);

    return {
      success: true,
      productId: product.product_id.toString(),
      message: `Product "${product.name}" updated successfully`,
    };
  } catch (error) {
    console.error("Error updating product:", error);

    if (error instanceof Error) {
      if (error.message.includes("unique_sku_per_organization")) {
        throw new Error(`SKU "${productData.sku}" already exists in this organization`);
      }
      throw error;
    }

    throw new Error("Failed to update product. Please try again.");
  }
}

export async function deleteProduct(orgId: string, productId: string) {
  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);

    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true },
    });

    const [product, orderItems] = await Promise.all([
      prisma.product.findFirst({
        where: { product_id: bigPid, org_id: bigOrgId },
        select: { product_id: true, name: true, sku: true },
      }),
      prisma.orderItem.findFirst({
        where: { product_id: bigPid },
        select: { order_item_id: true },
      }),
    ]);

    if (!product) {
      throw new Error("Product not found in this organization");
    }

    if (orderItems) {
      throw new Error(
        `Cannot delete product "${product.name}" because it has been ordered. ` +
        `Consider deactivating it instead.`
      );
    }

    const productName = product.name;

    await prisma.product.delete({
      where: { product_id: bigPid },
    });

    await sendNotification({
      userId,
      title: "Product Deleted",
      message: `Product "${productName}" (SKU: ${product.sku}) has been deleted from inventory`,
      type: "system",
      priority: "HIGH",
      link: `/inventory/${orgId}`,
    });

    const orgAdmins = await prisma.organizationMember.findMany({
      where: {
        org_id: bigOrgId,
        role: "admin",
        user: { clerk_id: { not: userId } },
      },
      include: { user: { select: { clerk_id: true } } },
    });

    await notifyMany(
      orgAdmins.map((a) => a.user.clerk_id),
      {
        title: "Product Deleted",
        message: `"${productName}" was deleted from "${org?.name}" inventory`,
        type: "system",
        priority: "MEDIUM",
        link: `/inventory/${orgId}`,
      }
    );

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "delete", "Product", { product_id: productId, name: productName }).catch(() => { });

    console.log(`✅ Product deleted: ${productId} (${productName})`);

    return {
      success: true,
      productId,
      message: `Product "${productName}" deleted successfully`,
    };
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to delete product. Please try again.");
  }
}

export async function bulkUpdateProducts(
  orgId: string,
  updates: { id: string; data: Omit<Product, "id" | "createdAt" | "updatedAt"> }[]
) {
  const userId = await requireRole(orgId, ["admin", "manager"]);
  if (!updates || updates.length === 0) throw new Error("No updates provided");

  try {
    const bigOrgId = toBigInt(orgId);
    const user = await getOrCreateUser(userId);

    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true },
    });

    const results = await prisma.$transaction(
      async (tx) => {
        const updateResults: { productId: string; name: string; sku: string }[] = [];

        for (const update of updates) {
          const productId = toBigInt(update.id);

          const updatedProduct = await tx.product.update({
            where: {
              product_id: productId,
              org_id: bigOrgId,
            },
            data: {
              name: update.data.name?.trim(),
              sku: update.data.sku?.trim(),
              description: update.data.description?.trim() ?? null,
              image_url: update.data.image?.trim() ?? null,
              modified_by: user.user_id,
            },
            select: { product_id: true, name: true, sku: true },
          });

          if (update.data.stock !== undefined) {
            const warehouse = await getOrCreateDefaultWarehouse(bigOrgId);

            const existingStock = await tx.productStock.findFirst({
              where: {
                product_id: productId,
                warehouse_id: warehouse.warehouse_id,
              },
              select: { stock_id: true },
            });

            if (existingStock) {
              await tx.productStock.update({
                where: { stock_id: existingStock.stock_id },
                data: { quantity: Math.max(0, update.data.stock) },
              });
            } else {
              await tx.productStock.create({
                data: {
                  product_id: productId,
                  warehouse_id: warehouse.warehouse_id,
                  quantity: Math.max(0, update.data.stock),
                },
              });
            }
          }

          if (update.data.price !== undefined) {
            const existingPrice = await tx.productPrice.findFirst({
              where: { product_id: productId },
              orderBy: { valid_from: "desc" },
              select: { price_id: true },
            });

            if (existingPrice) {
              await tx.productPrice.update({
                where: { price_id: existingPrice.price_id },
                data: { retail_price: Math.max(0, update.data.price) },
              });
            } else {
              await tx.productPrice.create({
                data: {
                  product_id: productId,
                  retail_price: Math.max(0, update.data.price),
                  valid_from: new Date(),
                },
              });
            }
          }

          updateResults.push({
            productId: updatedProduct.product_id.toString(),
            name: updatedProduct.name || "",
            sku: updatedProduct.sku || "",
          });
        }

        return updateResults;
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    console.log(`bulkUpdateProducts: Successfully updated ${results.length} products`);

    // Fire inventory trigger workflows for each updated product
    for (const r of results) {
      emitInventoryEvent(orgId, "update", "Product", { product_id: r.productId, name: r.name, sku: r.sku }).catch(() => { });
    }

    await sendNotification({
      userId: user.clerk_id,
      title: "Bulk Product Update Complete",
      message: `Successfully updated ${results.length} products in "${org?.name}" inventory`,
      type: "system",
      priority: "MEDIUM",
      link: `/inventory/${orgId}`,
    });

    await invalidateInventory(orgId);

    return {
      success: true,
      updatedCount: results.length,
      results,
      message: `Successfully updated ${results.length} products`,
    };
  } catch (error) {
    console.error("Bulk update products error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid organization or product ID format");
      }
      throw error;
    }

    throw new Error("Failed to update products. Please try again.");
  }
}

export async function warmupProductCache(orgId: string) {
  try {
    await ensureOrganizationMember(orgId);
    const role = await getUserRole(orgId);
    if (!await hasPermission(role, ["admin", "manager", "employee"])) {
      throw new Error("Insufficient permissions to access products");
    }

    const bigOrgId = toBigInt(orgId);

    const products = await prisma.product.findMany({
      where: { org_id: bigOrgId },
      include: {
        productStocks: true,
        productPrices: {
          orderBy: { valid_from: "desc" },
          take: 1,
        },
      },
    });

    const mappedProducts: Product[] = products.map((p) => ({
      id: p.product_id.toString(),
      name: p.name || "",
      sku: p.sku || "",
      description: p.description || undefined,
      stock: p.productStocks.reduce((acc, s) => acc + (s.quantity || 0), 0),
      price: p.productPrices[0]?.retail_price?.toNumber() || 0,
      image: p.image_url || "",
      createdAt: p.created_at ? p.created_at.toISOString() : new Date().toISOString(),
      updatedAt: p.updated_at ? p.updated_at.toISOString() : new Date().toISOString(),
    }));

    await CacheService.warmupCache(orgId, mappedProducts);

    console.log(
      `warmupProductCache: Warmed up cache for orgId: ${orgId} with ${mappedProducts.length} products`
    );

    return {
      success: true,
      cachedCount: mappedProducts.length,
      message: `Cache warmed up with ${mappedProducts.length} products`,
    };
  } catch (error) {
    console.error("Error warming up product cache:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to warm up cache"
    );
  }
}

export async function getProductDetails(orgId: string, productId: string) {
  if (!orgId || !productId) throw new Error("Missing required parameters");

  await requireRole(orgId, ["admin", "manager", "employee"]);

  try {
    return await getCachedProductDetails(orgId, productId);
  } catch (error) {
    console.error("Error fetching product details:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid product or organization ID format");
      }
      throw error;
    }

    throw new Error("Failed to fetch product details. Please try again.");
  }
}

export async function updateProductDetails(
  orgId: string,
  productId: string,
  data: any
) {
  if (!orgId || !productId) throw new Error("Missing required parameters");

  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { user_id: true },
    });
    if (!user) throw new Error("User not found");

    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { product_id: bigPid, org_id: bigOrgId },
        data: {
          name: data.name?.trim(),
          sku: data.sku?.trim(),
          description: data.description?.trim(),
          image_url: data.image?.trim(),
          status: data.status?.trim(),
          modified_by: user.user_id,
        },
      });

      if (
        data.price !== undefined ||
        data.actualPrice !== undefined ||
        data.marketPrice !== undefined
      ) {
        await tx.productPrice.updateMany({
          where: { product_id: bigPid, valid_to: null },
          data: { valid_to: new Date() },
        });
        await tx.productPrice.create({
          data: {
            product_id: bigPid,
            retail_price: data.price ?? 0,
            actual_price: data.actualPrice,
            market_price: data.marketPrice,
            valid_from: new Date(),
          },
        });
      }
    });

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "Product", { product_id: productId, ...data }).catch(() => { });

    return { success: true };
  } catch (error) {
    console.error("Error updating product details:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid product or organization ID format");
      }
      throw error;
    }

    throw new Error("Failed to update product. Please try again.");
  }
}

export async function deleteProductDetails(orgId: string, productId: string) {
  if (!orgId || !productId) throw new Error("Missing required parameters");

  await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigPid = toBigInt(productId);
    const bigOrgId = toBigInt(orgId);

    const [product, orderItems] = await Promise.all([
      prisma.product.findFirst({
        where: { product_id: bigPid, org_id: bigOrgId },
        select: {
          product_id: true,
          name: true,
          status: true,
          _count: {
            select: {
              productStocks: true,
              productPrices: true,
            },
          },
        },
      }),
      prisma.orderItem.findMany({
        where: { product_id: bigPid },
        select: {
          order_item_id: true,
          order: {
            select: {
              order_id: true,
              order_date: true,
              customer_name: true,
              status: true,
            },
          },
        },
        take: 5,
      }),
    ]);

    if (!product) {
      throw new Error("Product not found in this organization");
    }

    if (orderItems.length > 0) {
      const orderDetails = orderItems
        .map(
          (item) =>
            `Order #${item.order.order_id} (${item.order.customer_name || "Unknown Customer"
            })`
        )
        .slice(0, 3)
        .join(", ");

      const moreOrders =
        orderItems.length > 3 ? ` and ${orderItems.length - 3} more` : "";

      throw new Error(
        `Cannot delete product "${product.name}" because it has been ordered. ` +
        `Referenced in: ${orderDetails}${moreOrders}. ` +
        `Consider deactivating the product instead.`
      );
    }

    const totalStock = await prisma.productStock.aggregate({
      where: { product_id: bigPid },
      _sum: { quantity: true },
    });

    if ((totalStock._sum.quantity || 0) > 0) {
      console.warn(
        `Deleting product ${productId} with ${totalStock._sum.quantity} units in stock`
      );
    }

    await prisma.product.delete({ where: { product_id: bigPid } });

    console.log(`Successfully deleted product ${productId} (${product.name})`);

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "delete", "Product", { product_id: productId, name: product.name }).catch(() => { });

    return {
      success: true,
      productId: productId.toString(),
      productName: product.name,
      message: `Product "${product.name}" has been successfully deleted`,
    };
  } catch (error) {
    console.error("Error deleting product:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid organization or product ID format");
      }
      throw error;
    }

    throw new Error("Failed to delete product. Please try again.");
  }
}

export async function updateProductStock(
  orgId: string,
  productId: string,
  warehouseId: string,
  adjustment: number
) {
  const userId = await requireAuth();
  if (!orgId) throw new Error("Organization ID is required");
  if (!productId) throw new Error("Product ID is required");
  if (!warehouseId) throw new Error("Warehouse ID is required");

  try {
    const bigOrgId = toBigInt(orgId);
    const bigProductId = toBigInt(productId);
    const bigWarehouseId = toBigInt(warehouseId);

    await ensureOrganizationMember(orgId);

    const role = await getUserRole(orgId);
    if (!(await hasPermission(role, ["admin", "manager", "employee"]))) {
      throw new Error("Insufficient permissions to update stock");
    }

    const user = await getOrCreateUser(userId);

    const [product, warehouse, org] = await Promise.all([
      prisma.product.findUnique({
        where: { product_id: bigProductId },
        select: { name: true, sku: true },
      }),
      prisma.warehouse.findUnique({
        where: { warehouse_id: bigWarehouseId },
        select: { name: true },
      }),
      prisma.organization.findUnique({
        where: { org_id: bigOrgId },
        select: { name: true },
      }),
    ]);

    let newQuantity = 0;

    await prisma.$transaction(async (tx) => {
      const existingStock = await tx.productStock.findFirst({
        where: {
          product_id: bigProductId,
          warehouse_id: bigWarehouseId,
        },
        select: { stock_id: true, quantity: true },
      });

      newQuantity = (existingStock?.quantity || 0) + adjustment;

      if (newQuantity < 0) {
        throw new Error("Insufficient stock for this adjustment");
      }

      if (existingStock) {
        await tx.productStock.update({
          where: { stock_id: existingStock.stock_id },
          data: { quantity: newQuantity },
        });
      } else {
        await tx.productStock.create({
          data: {
            product_id: bigProductId,
            warehouse_id: bigWarehouseId,
            quantity: Math.max(0, adjustment),
          },
        });
      }
    });

    await sendNotification({
      userId: user.clerk_id,
      title: "Stock Updated",
      message: `Stock for "${product?.name}" at ${warehouse?.name}: ${adjustment > 0 ? "+" : ""
        }${adjustment} (New: ${newQuantity})`,
      type: "system",
      priority: newQuantity < 10 ? "HIGH" : "MEDIUM",
      link: `/inventory/${orgId}`,
    });

    if (newQuantity < 10) {
      const orgManagers = await prisma.organizationMember.findMany({
        where: {
          org_id: bigOrgId,
          role: { in: ["admin", "manager"] },
          user: { clerk_id: { not: userId } },
        },
        include: { user: { select: { clerk_id: true } } },
      });

      await notifyMany(
        orgManagers.map((m) => m.user.clerk_id),
        {
          title: "Low Stock Alert",
          message: `"${product?.name}" stock at ${warehouse?.name} is low: ${newQuantity} units`,
          type: "system",
          priority: "HIGH",
          link: `/inventory/${orgId}`,
        }
      );
    }

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "ProductStock", { product_id: productId, name: product?.name, sku: product?.sku, quantity: newQuantity }).catch(() => { });

    return { success: true };
  } catch (error) {
    console.error("Error updating product stock:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to update stock. Please try again.");
  }
}

export async function transferStock(
  orgId: string,
  productId: string,
  fromWarehouseId: string,
  toWarehouseId: string,
  quantity: number,
  reason: string,
  notes?: string
) {
  if (!orgId || !productId || !fromWarehouseId || !toWarehouseId) {
    throw new Error("Missing required parameters");
  }

  await requireRole(orgId, ["admin", "manager", "employee"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);
    const bigFromWarehouse = toBigInt(fromWarehouseId);
    const bigToWarehouse = toBigInt(toWarehouseId);

    await prisma.$transaction(async (tx) => {
      const fromStock = await tx.productStock.findFirst({
        where: { product_id: bigPid, warehouse_id: bigFromWarehouse },
      });

      if (!fromStock || (fromStock.quantity || 0) < quantity) {
        throw new Error("Insufficient stock in source warehouse");
      }

      await tx.productStock.update({
        where: { stock_id: fromStock.stock_id },
        data: { quantity: (fromStock.quantity || 0) - quantity },
      });

      const toStock = await tx.productStock.findFirst({
        where: { product_id: bigPid, warehouse_id: bigToWarehouse },
      });

      if (toStock) {
        await tx.productStock.update({
          where: { stock_id: toStock.stock_id },
          data: { quantity: (toStock.quantity || 0) + quantity },
        });
      } else {
        await tx.productStock.create({
          data: {
            product_id: bigPid,
            warehouse_id: bigToWarehouse,
            quantity,
          },
        });
      }
    });

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "ProductStock", { product_id: productId, action: "transfer" }).catch(() => { });

    return { success: true };
  } catch (error) {
    console.error("Error transferring stock:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to transfer stock. Please try again.");
  }
}

export async function getWarehousesWithStock(orgId: string, productId: string) {
  if (!orgId) throw new Error("Organization ID is required");
  if (!productId) throw new Error("Product ID is required");

  await requireRole(orgId, ["admin", "manager", "employee"]);

  try {
    return await getCachedWarehousesWithStock(orgId, productId);
  } catch (error) {
    console.error("Error fetching warehouses with stock:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid organization or product ID format");
      }
      throw error;
    }

    throw new Error("Failed to fetch warehouse stock data. Please try again.");
  }
}

const getCachedWarehousesWithStock = unstable_cache(
  async (orgId: string, productId: string) => {
    const bigOrgId = toBigInt(orgId);
    const bigProductId = toBigInt(productId);

    const warehouses = await prisma.warehouse.findMany({
      where: { org_id: bigOrgId },
      include: {
        productStocks: {
          where: { product_id: bigProductId },
          select: {
            quantity: true,
            stock_id: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return warehouses.map((warehouse) => ({
      id: warehouse.warehouse_id.toString(),
      name: warehouse.name || "Unnamed Warehouse",
      address: warehouse.address || "",
      currentStock: warehouse.productStocks[0]?.quantity ?? 0,
    }));
  },
  ["warehouses-with-stock"],
  {
    tags: [TAGS.WAREHOUSE, TAGS.PRODUCT],
    revalidate: 60,
  }
);

export async function deactivateProduct(
  orgId: string,
  productId: string,
  reason?: string
) {
  if (!orgId || !productId) throw new Error("Missing required parameters");

  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { user_id: true },
    });
    if (!user) throw new Error("User not found");

    const product = await prisma.product.update({
      where: { product_id: bigPid, org_id: bigOrgId },
      data: {
        status: "discontinued",
        modified_by: user.user_id,
      },
      select: { name: true },
    });

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "Product", { product_id: productId, name: product.name, status: "discontinued" }).catch(() => { });

    return {
      success: true,
      productId: productId.toString(),
      productName: product.name,
      message: `Product "${product.name}" has been deactivated`,
    };
  } catch (error) {
    console.error("Error deactivating product:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid organization or product ID format");
      }
      throw error;
    }

    throw new Error("Failed to deactivate product. Please try again.");
  }
}

export async function activateProduct(orgId: string, productId: string) {
  if (!orgId || !productId) throw new Error("Missing required parameters");

  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { user_id: true },
    });
    if (!user) throw new Error("User not found");

    const product = await prisma.product.update({
      where: { product_id: bigPid, org_id: bigOrgId },
      data: {
        status: "active",
        modified_by: user.user_id,
      },
      select: { name: true, status: true },
    });

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "Product", { product_id: productId, name: product.name, status: product.status }).catch(() => { });

    return {
      success: true,
      productId: productId.toString(),
      productName: product.name,
      status: product.status,
      message: `Product "${product.name}" has been activated`,
    };
  } catch (error) {
    console.error("Error activating product:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid organization or product ID format");
      }
      throw error;
    }

    throw new Error("Failed to activate product. Please try again.");
  }
}

export async function updateProductStatus(
  orgId: string,
  productId: string,
  status: "active" | "inactive" | "discontinued"
) {
  if (!orgId || !productId) throw new Error("Missing required parameters");

  const userId = await requireRole(orgId, ["admin", "manager"]);

  try {
    const bigOrgId = toBigInt(orgId);
    const bigPid = toBigInt(productId);

    const user = await prisma.user.findUnique({
      where: { clerk_id: userId },
      select: { user_id: true },
    });
    if (!user) throw new Error("User not found");

    const product = await prisma.product.update({
      where: { product_id: bigPid, org_id: bigOrgId },
      data: {
        status,
        modified_by: user.user_id,
      },
      select: { name: true, status: true },
    });

    await invalidateInventory(orgId, productId);

    // Fire inventory trigger workflows
    emitInventoryEvent(orgId, "update", "Product", { product_id: productId, name: product.name, status: product.status }).catch(() => { });

    return {
      success: true,
      productId: productId.toString(),
      productName: product.name,
      status: product.status,
      message: `Product "${product.name}" status updated to ${status}`,
    };
  } catch (error) {
    console.error("Error updating product status:", error);
    throw new Error("Failed to update product status. Please try again.");
  }
}

export async function getWarehousesForDialog(orgId: string) {
  "use server";

  if (!orgId) throw new Error("Organization ID is required");

  try {
    await requireRole(orgId, ["admin", "manager", "employee"]);

    const bigOrgId = toBigInt(orgId);

    const warehouses = await prisma.warehouse.findMany({
      where: { org_id: bigOrgId },
      select: {
        warehouse_id: true,
        name: true,
        address: true,
      },
      orderBy: { name: "asc" },
    });

    console.log("Fetched warehouses in action:", warehouses.length);

    return warehouses.map((w) => ({
      id: w.warehouse_id.toString(),
      name: w.name || "Unnamed Warehouse",
      address: w.address || "",
    }));
  } catch (error) {
    console.error("Error fetching warehouses for dialog:", error);

    if (error instanceof Error) {
      if (error.message.includes("Cannot convert") && error.message.includes("BigInt")) {
        throw new Error("Invalid organization ID format");
      }
      throw error;
    }

    throw new Error("Failed to fetch warehouses. Please try again.");
  }
}
