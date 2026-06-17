"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useOrgStore } from "@/hooks/useOrgStore";
import { getUsageStats } from "@/app/(dashboard)/billing/billing-actions";
import { Zap, ArrowUpRight, Crown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-zinc-500",
  starter: "bg-blue-500",
  pro: "bg-violet-500",
  enterprise: "bg-amber-500",
};

const PLAN_GRADIENT: Record<string, string> = {
  free: "from-zinc-500/20 to-zinc-600/5",
  starter: "from-blue-500/20 to-blue-600/5",
  pro: "from-violet-500/20 to-violet-600/5",
  enterprise: "from-amber-500/20 to-amber-600/5",
};

interface UsageMeterProps {
  isCollapsed: boolean;
}

export function UsageMeter({ isCollapsed }: UsageMeterProps) {
  const { selectedOrgId } = useOrgStore();
  const [stats, setStats] = useState<any>(null);

  const loadStats = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const data = await getUsageStats(selectedOrgId);
      setStats(data);
    } catch {
      // silently fail
    }
  }, [selectedOrgId]);

  useEffect(() => {
    loadStats();
    // Refresh every 5 minutes
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (!stats || !selectedOrgId) return null;

  const planColor = PLAN_COLORS[stats.plan] || PLAN_COLORS.free;
  const planGradient = PLAN_GRADIENT[stats.plan] || PLAN_GRADIENT.free;
  const showUpgrade = stats.plan === "free" || stats.plan === "starter";

  const workflowPct = stats.workflows.percentage;
  const barColor =
    workflowPct >= 90
      ? "bg-red-500"
      : workflowPct >= 70
      ? "bg-amber-500"
      : "bg-violet-500";

  // Collapsed: show just an icon with tooltip
  if (isCollapsed) {
    return (
      <div className="p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/billing"
              className="flex items-center justify-center p-2 rounded-xl transition-colors hover:bg-accent"
            >
              <div className="relative">
                <Crown
                  size={20}
                  className={
                    stats.plan === "free"
                      ? "text-zinc-400"
                      : stats.plan === "pro"
                      ? "text-violet-500"
                      : stats.plan === "enterprise"
                      ? "text-amber-500"
                      : "text-blue-500"
                  }
                />
                {/* Usage dot indicator */}
                <div
                  className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                    workflowPct >= 90
                      ? "bg-red-500"
                      : workflowPct >= 70
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                />
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="space-y-1">
            <p className="font-semibold">{stats.planName} Plan</p>
            <p className="text-xs text-muted-foreground">
              {stats.workflows.current}/{stats.workflows.limit === -1 ? "∞" : stats.workflows.limit} workflows
            </p>
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  // Expanded: full meter
  return (
    <div className="p-3">
      <Link href="/billing" className="block group">
        <div
          className={`rounded-xl p-3 bg-gradient-to-b ${planGradient} border border-border/30 transition-all duration-200 group-hover:border-border/60 group-hover:shadow-sm`}
        >
          {/* Plan badge + upgrade link */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${planColor}`} />
              <span className="text-xs font-semibold">
                {stats.planName}
              </span>
            </div>
            {showUpgrade && (
              <div className="flex items-center gap-0.5 text-[10px] font-medium text-violet-500 group-hover:text-violet-400 transition-colors">
                <Zap size={10} />
                Upgrade
                <ArrowUpRight size={10} />
              </div>
            )}
          </div>

          {/* Workflow usage bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Workflows</span>
              <span className="font-medium tabular-nums">
                {stats.workflows.current}
                <span className="text-muted-foreground">
                  /{stats.workflows.limit === -1 ? "∞" : stats.workflows.limit}
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{
                  width: `${stats.workflows.limit === -1 ? 0 : workflowPct}%`,
                }}
              />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
