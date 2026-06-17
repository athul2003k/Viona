export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  role: string;
  joinedAt: string;
  stats?: {
    orders: number;
    products: number;
    workflows: number;
  };
}

export interface MemberActivity {
  orderCount: number;
  productCreatedCount: number;
  productModifiedCount: number;
  workflowCount: number;
  recentOrders: Array<{
    id: string;
    date: string;
    status: string;
    total: number;
  }>;
  recentProducts: Array<{
    id: string;
    name: string;
    sku: string;
    createdAt: string;
  }>;
  recentWorkflows: Array<{
    id: string;
    name: string;
    status: string;
    updatedAt: string;
  }>;
}
