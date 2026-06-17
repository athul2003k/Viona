"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface UsageMetric {
  current: number;
  limit: number;
  percentage?: number;
}

interface UsageOverviewProps {
  usage: {
    workflows: UsageMetric;
    orders: UsageMetric;
    members: UsageMetric;
    aiRuns: UsageMetric;
  };
}

const formatLimit = (limit: number) => (limit === -1 ? "∞" : limit.toString());

const getProgressColor = (percentage: number) => {
  if (percentage >= 90) return "bg-red-500";
  if (percentage >= 70) return "bg-amber-500";
  return "bg-violet-500";
};

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const percentage = limit === -1 ? 0 : Math.min((current / limit) * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {current} / {formatLimit(limit)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(
            percentage
          )}`}
          style={{ width: `${limit === -1 ? 0 : percentage}%` }}
        />
      </div>
    </div>
  );
}

export function UsageOverview({ usage }: UsageOverviewProps) {
  return (
    <Card className="p-6 rounded-2xl border border-border/50">
      <h3 className="text-lg font-semibold mb-6">Usage This Month</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UsageBar
          label="Workflows"
          current={usage.workflows.current}
          limit={usage.workflows.limit}
        />
        <UsageBar
          label="Orders"
          current={usage.orders.current}
          limit={usage.orders.limit}
        />
        <UsageBar
          label="Team Members"
          current={usage.members.current}
          limit={usage.members.limit}
        />
        <UsageBar
          label="AI Agent Runs"
          current={usage.aiRuns.current}
          limit={usage.aiRuns.limit}
        />
      </div>
    </Card>
  );
}
