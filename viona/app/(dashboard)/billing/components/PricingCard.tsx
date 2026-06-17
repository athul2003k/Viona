"use client";

import React from "react";
import { Check, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PricingCardProps {
  name: string;
  price: number; // -1 = custom
  features: string[];
  isCurrentPlan: boolean;
  isPopular?: boolean;
  onSelect: () => void;
  loading?: boolean;
  currentPlan: string;
}

export function PricingCard({
  name,
  price,
  features,
  isCurrentPlan,
  isPopular,
  onSelect,
  loading,
  currentPlan,
}: PricingCardProps) {
  const isEnterprise = price === -1;
  const isFree = price === 0;
  const isDowngrade =
    !isCurrentPlan &&
    ((currentPlan === "pro" && (name === "Starter" || name === "Free")) ||
      (currentPlan === "starter" && name === "Free"));

  return (
    <Card
      className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-300 hover:shadow-lg ${
        isPopular
          ? "border-violet-500/50 shadow-violet-500/10 shadow-lg bg-gradient-to-b from-violet-500/5 to-transparent"
          : isCurrentPlan
          ? "border-emerald-500/50 bg-emerald-500/5"
          : "border-border/50 hover:border-violet-500/30"
      }`}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold shadow-md">
            <Sparkles size={12} />
            Most Popular
          </div>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <div className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold shadow-md">
            Current Plan
          </div>
        </div>
      )}

      {/* Plan name & price */}
      <div className="mb-6 mt-2">
        <h3 className="text-lg font-semibold">{name}</h3>
        <div className="mt-2 flex items-baseline gap-1">
          {isEnterprise ? (
            <span className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Custom
            </span>
          ) : (
            <>
              <span className="text-4xl font-bold">${price}</span>
              {!isFree && (
                <span className="text-muted-foreground text-sm">/month</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Features list */}
      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <Check
              size={16}
              className={`shrink-0 mt-0.5 ${
                isPopular ? "text-violet-500" : "text-emerald-500"
              }`}
            />
            <span className="text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <Button
        onClick={onSelect}
        disabled={isCurrentPlan || loading}
        className={`w-full rounded-xl font-medium ${
          isPopular
            ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white"
            : isEnterprise
            ? "bg-secondary hover:bg-secondary/80"
            : ""
        }`}
        variant={isPopular || isEnterprise ? "default" : "outline"}
      >
        {loading
          ? "Processing..."
          : isCurrentPlan
          ? "Current Plan"
          : isEnterprise
          ? "Contact Sales"
          : isFree
          ? "Downgrade to Free"
          : isDowngrade
          ? `Downgrade to ${name}`
          : `Upgrade to ${name}`}
      </Button>
    </Card>
  );
}
