"use client";

import React, { useEffect, useState } from 'react';
import { useOrgStore } from '@/hooks/useOrgStore';
import {
  getDashboardStats,
  getRecentWorkflows,
  getRecentOrders,
  getLowStockProducts,
  getRevenueChartData
} from './dashboard-actions';
import { SummaryCards } from './components/SummaryCards';
import { RecentWorkflows } from './components/RecentWorkflows';
import { RecentOrders } from './components/RecentOrders';
import { LowStockProducts } from './components/LowStockProducts';
import { RevenueChart } from './components/RevenueChart';
import { OrganizationSelector } from '@/app/(dashboard)/organization/components/OrganizationSelector';
import { OrganizationState } from '@/components/OrganizationState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
  const router = useRouter();

  const [stats, setStats] = useState({ workflows: 0, orders: 0, products: 0, revenue: 0 });
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!selectedOrgId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const [statsData, workflowsData, ordersData, stockData, chartResults] = await Promise.all([
          getDashboardStats(selectedOrgId!),
          getRecentWorkflows(selectedOrgId!),
          getRecentOrders(selectedOrgId!),
          getLowStockProducts(selectedOrgId!),
          getRevenueChartData(selectedOrgId!)
        ]);

        if (isMounted) {
          setStats(statsData);
          setWorkflows(workflowsData);
          setOrders(ordersData);
          setLowStock(stockData);
          setChartData(chartResults);
        }
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId]);

  if (orgs.length === 0 || !selectedOrgId) {
    return (
      <OrganizationState 
        hasOrganizations={orgs.length > 0} 
        hasSelectedOrg={!!selectedOrgId}
        orgs={orgs}
        selectedOrgId={selectedOrgId}
        onOrganizationSelect={(id) => setSelectedOrgId(id)}
      />
    );
  }

  return (
    <div className="flex-1 space-y-6 p-1 md:p-6 w-full max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="h-24 bg-muted/40" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="h-[350px] md:col-span-2 bg-muted/40" />
            <Card className="h-[350px] col-span-1 bg-muted/40" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SummaryCards stats={stats} />
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
            <RevenueChart data={chartData} />
            <LowStockProducts products={lowStock} />
          </div>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <RecentOrders orders={orders} />
            <RecentWorkflows workflows={workflows} />
          </div>
        </div>
      )}
    </div>
  );
}