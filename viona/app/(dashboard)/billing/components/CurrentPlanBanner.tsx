"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface CurrentPlanBannerProps {
  planName: string;
  status: string;
  price: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  onManageBilling: () => void;
  loading?: boolean;
  hasStripeCustomer: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  active: {
    label: "Active",
    color: "text-emerald-500 bg-emerald-500/10",
    icon: CheckCircle2,
  },
  past_due: {
    label: "Past Due",
    color: "text-amber-500 bg-amber-500/10",
    icon: AlertTriangle,
  },
  canceled: {
    label: "Canceled",
    color: "text-red-500 bg-red-500/10",
    icon: AlertTriangle,
  },
  trialing: {
    label: "Trial",
    color: "text-blue-500 bg-blue-500/10",
    icon: CheckCircle2,
  },
};

export function CurrentPlanBanner({
  planName,
  status,
  price,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  onManageBilling,
  loading,
  hasStripeCustomer,
}: CurrentPlanBannerProps) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="p-6 rounded-2xl border border-border/50 bg-gradient-to-r from-violet-500/5 via-transparent to-purple-500/5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{planName} Plan</h2>
            <div
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig.color}`}
            >
              <StatusIcon size={12} />
              {statusConfig.label}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {price > 0 && (
              <div className="flex items-center gap-1.5">
                <CreditCard size={14} />
                <span>${price}/month</span>
              </div>
            )}
            {currentPeriodEnd && (
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                <span>
                  {cancelAtPeriodEnd ? "Expires" : "Renews"}{" "}
                  {new Date(currentPeriodEnd).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {cancelAtPeriodEnd && (
            <p className="text-sm text-amber-500 font-medium">
              ⚠️ Your subscription will be canceled at the end of the billing
              period.
            </p>
          )}
        </div>

        {hasStripeCustomer && (
          <Button
            variant="outline"
            onClick={onManageBilling}
            disabled={loading}
            className="shrink-0 rounded-xl"
          >
            <CreditCard size={16} className="mr-2" />
            {loading ? "Opening..." : "Manage Billing"}
          </Button>
        )}
      </div>
    </Card>
  );
}
