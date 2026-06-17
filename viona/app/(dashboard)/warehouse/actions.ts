'use server';

import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { getUserRole, hasPermission, ensureOrganizationMember } from '@/lib/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { sendNotification } from '@/lib/rabbitmq';

function invalidateWarehouseCaches() {
  revalidateTag('warehouses');
  revalidateTag('warehouse-list');
}

export async function createWarehouse(orgId: string, data: { name: string; address: string }) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!data.name?.trim()) throw new Error('Warehouse name is required');
  if (!data.address?.trim()) throw new Error('Warehouse address is required');

  try {
    await ensureOrganizationMember(orgId);

    const role = await getUserRole(orgId);
    if (!(await hasPermission(role, ['admin', 'manager']))) {
      throw new Error('Insufficient permissions to create warehouse');
    }

    const bigOrgId = BigInt(orgId);

    // Get organization and user info for notifications
    const [org, user] = await Promise.all([
      prisma.organization.findUnique({
        where: { org_id: bigOrgId },
        select: { name: true }
      }),
      prisma.user.findUnique({
        where: { clerk_id: userId },
        select: { clerk_id: true }
      })
    ]);

    const warehouse = await prisma.warehouse.create({
      data: {
        org_id: bigOrgId,
        name: data.name.trim(),
        address: data.address.trim(),
      },
      select: {
        warehouse_id: true,
        name: true,
        address: true,
        created_at: true,
      }
    });

    // ✅ Notify the creator
    await sendNotification({
      userId: userId,
      title: 'Warehouse Created',
      message: `Warehouse "${warehouse.name}" has been created in "${org?.name}"`,
      type: 'system',
      priority: 'MEDIUM',
      link: `/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`,
    });

    // ✅ Notify organization admins
    const orgAdmins = await prisma.organizationMember.findMany({
      where: {
        org_id: bigOrgId,
        role: 'admin',
        user: { clerk_id: { not: userId } },
      },
      include: {
        user: { select: { clerk_id: true } }
      }
    });

    for (const admin of orgAdmins) {
      await sendNotification({
        userId: admin.user.clerk_id,
        title: 'New Warehouse Added',
        message: `Warehouse "${warehouse.name}" was added to "${org?.name}"`,
        type: 'system',
        priority: 'LOW',
        link: `/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`,
      });
    }

    invalidateWarehouseCaches();

    revalidatePath('/warehouse');
    revalidatePath('/dashboard');

    return {
      success: true,
      warehouseId: warehouse.warehouse_id.toString(),
      data: {
        id: warehouse.warehouse_id.toString(),
        name: warehouse.name,
        address: warehouse.address,
        createdAt: warehouse.created_at?.toISOString(),
      },
      message: `Warehouse "${warehouse.name}" has been successfully created`,
    };
  } catch (error) {
    console.error('Error creating warehouse:', error);
    throw error instanceof Error ? error : new Error('Failed to create warehouse');
  }
}

export async function updateWarehouse(
  orgId: string,
  warehouseId: string,
  data: { name: string; address: string }
) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  if (!data.name?.trim()) throw new Error('Warehouse name is required');
  if (!data.address?.trim()) throw new Error('Warehouse address is required');

  try {
    await ensureOrganizationMember(orgId);

    const role = await getUserRole(orgId);
    if (!(await hasPermission(role, ['admin', 'manager']))) {
      throw new Error('Insufficient permissions to update warehouse');
    }

    const bigOrgId = BigInt(orgId);
    const bigWarehouseId = BigInt(warehouseId);

    // Get organization info for notifications
    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true }
    });

    // Verify warehouse belongs to organization
    const existingWarehouse = await prisma.warehouse.findFirst({
      where: {
        warehouse_id: bigWarehouseId,
        org_id: bigOrgId,
      },
      select: { warehouse_id: true, name: true }
    });

    if (!existingWarehouse) {
      throw new Error('Warehouse not found in this organization');
    }

    const oldName = existingWarehouse.name;

    const warehouse = await prisma.warehouse.update({
      where: { warehouse_id: bigWarehouseId },
      data: {
        name: data.name.trim(),
        address: data.address.trim(),
      },
      select: {
        warehouse_id: true,
        name: true,
        address: true,
        updated_at: true,
      }
    });

    // ✅ Notify the updater
    await sendNotification({
      userId: userId,
      title: 'Warehouse Updated',
      message: `Warehouse "${oldName}" has been updated to "${warehouse.name}"`,
      type: 'system',
      priority: 'MEDIUM',
      link: `/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`,
    });

    // ✅ Notify organization managers and admins
    const orgMembers = await prisma.organizationMember.findMany({
      where: {
        org_id: bigOrgId,
        role: { in: ['admin', 'manager'] },
        user: { clerk_id: { not: userId } },
      },
      include: {
        user: { select: { clerk_id: true } }
      }
    });

    for (const member of orgMembers) {
      await sendNotification({
        userId: member.user.clerk_id,
        title: 'Warehouse Updated',
        message: `Warehouse "${oldName}" in "${org?.name}" was updated to "${warehouse.name}"`,
        type: 'system',
        priority: 'LOW',
        link: `/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`,
      });
    }

    invalidateWarehouseCaches();
    revalidatePath('/warehouse');
    revalidatePath(`/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`);
    revalidatePath('/dashboard');

    return {
      success: true,
      warehouseId: warehouse.warehouse_id.toString(),
      data: {
        id: warehouse.warehouse_id.toString(),
        name: warehouse.name,
        address: warehouse.address,
        updatedAt: warehouse.updated_at?.toISOString(),
      },
      message: `Warehouse "${warehouse.name}" has been successfully updated`,
    };
  } catch (error) {
    console.error('Error updating warehouse:', error);
    throw error instanceof Error ? error : new Error('Failed to update warehouse');
  }
}

export async function deleteWarehouse(orgId: string, warehouseId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  try {
    await ensureOrganizationMember(orgId);

    const role = await getUserRole(orgId);
    if (!(await hasPermission(role, ['admin']))) {
      throw new Error('Only admins can delete warehouses');
    }

    const bigOrgId = BigInt(orgId);
    const bigWarehouseId = BigInt(warehouseId);

    // Get organization info for notifications
    const org = await prisma.organization.findUnique({
      where: { org_id: bigOrgId },
      select: { name: true }
    });

    // Check if it's the default/first warehouse
    const warehouses = await prisma.warehouse.findMany({
      where: { org_id: bigOrgId },
      orderBy: { created_at: 'asc' },
      select: { warehouse_id: true, name: true }
    });

    if (warehouses.length === 1) {
      throw new Error('Cannot delete the last warehouse. Organizations must have at least one warehouse.');
    }

    if (warehouses[0].warehouse_id === bigWarehouseId) {
      throw new Error('Cannot delete the default warehouse. Please set another warehouse as default first.');
    }

    // Check for existing stock
    const stockCount = await prisma.productStock.count({
      where: { warehouse_id: bigWarehouseId }
    });

    if (stockCount > 0) {
      throw new Error('Cannot delete warehouse with existing stock. Please move or remove all stock first.');
    }

    const warehouseName = warehouses.find(w => w.warehouse_id === bigWarehouseId)?.name;

    await prisma.warehouse.delete({
      where: { warehouse_id: bigWarehouseId }
    });

    // ✅ Notify the deleter
    await sendNotification({
      userId: userId,
      title: 'Warehouse Deleted',
      message: `Warehouse "${warehouseName}" has been deleted from "${org?.name}"`,
      type: 'system',
      priority: 'HIGH',
      link: `/warehouse`,
    });

    // ✅ Notify organization admins
    const orgAdmins = await prisma.organizationMember.findMany({
      where: {
        org_id: bigOrgId,
        role: 'admin',
        user: { clerk_id: { not: userId } },
      },
      include: {
        user: { select: { clerk_id: true } }
      }
    });

    for (const admin of orgAdmins) {
      await sendNotification({
        userId: admin.user.clerk_id,
        title: 'Warehouse Deleted',
        message: `Warehouse "${warehouseName}" was deleted from "${org?.name}"`,
        type: 'system',
        priority: 'MEDIUM',
        link: `/warehouse`,
      });
    }

    invalidateWarehouseCaches();

    revalidatePath('/warehouse');
    revalidatePath('/dashboard');

    return {
      success: true,
      warehouseId,
      message: 'Warehouse has been successfully deleted',
    };
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    throw error instanceof Error ? error : new Error('Failed to delete warehouse');
  }
}

export async function ensureDefaultWarehouse(orgId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  try {
    await ensureOrganizationMember(orgId);
    const bigOrgId = BigInt(orgId);

    const existingWarehouse = await prisma.warehouse.findFirst({
      where: { org_id: bigOrgId },
      select: { warehouse_id: true }
    });

    if (!existingWarehouse) {
      const warehouse = await prisma.warehouse.create({
        data: {
          org_id: bigOrgId,
          name: 'Default Warehouse',
          address: 'Default Address',
        },
        select: { warehouse_id: true, name: true }
      });

      // ✅ Notify about default warehouse creation
      await sendNotification({
        userId: userId,
        title: 'Default Warehouse Created',
        message: `A default warehouse has been created for your organization`,
        type: 'system',
        priority: 'LOW',
        link: `/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`,
      });

      revalidatePath('/warehouse');
      revalidatePath(`/warehouse/${warehouse.warehouse_id.toString()}?orgId=${orgId}`);

      return {
        success: true,
        warehouseId: warehouse.warehouse_id.toString(),
        message: 'Default warehouse created',
      };
    }

    return {
      success: true,
      warehouseId: existingWarehouse.warehouse_id.toString(),
      message: 'Default warehouse already exists',
    };
  } catch (error) {
    console.error('Error ensuring default warehouse:', error);
    throw error instanceof Error ? error : new Error('Failed to ensure default warehouse');
  }
}
