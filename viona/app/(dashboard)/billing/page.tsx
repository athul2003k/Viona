"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrgStore } from "@/hooks/useOrgStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrganizationSelector } from "@/app/(dashboard)/organization/components/OrganizationSelector";
import { OrganizationState } from "@/components/OrganizationState";
import { PricingCard } from "./components/PricingCard";
import { UsageOverview } from "./components/UsageOverview";
import { CurrentPlanBanner } from "./components/CurrentPlanBanner";
import {
  getSubscriptionDetails,
  getPlans,
  createCheckoutSession,
  createBillingPortalSession,
} from "./billing-actions";
import { toast } from "sonner";
import type { PlanId } from "@/lib/stripe";

function BillingPageContent() {
  const { selectedOrgId, orgs, setSelectedOrgId } = useOrgStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [subscription, setSubscription] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (success === "true") {
      toast.success("Subscription activated successfully!");
      router.replace("/billing");
    }
    if (canceled === "true") {
      toast.info("Checkout was canceled.");
      router.replace("/billing");
    }
  }, [searchParams, router]);

  const loadData = useCallback(async () => {
    if (!selectedOrgId) return;
    setIsLoading(true);
    try {
      const [subDetails, planList] = await Promise.all([
        getSubscriptionDetails(selectedOrgId),
        getPlans(),
      ]);
      setSubscription(subDetails);
      setPlans(planList);
    } catch (error) {
      console.error("Failed to load billing data:", error);
      toast.error("Failed to load billing data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectPlan = async (planId: PlanId) => {
    if (!selectedOrgId) return;

    if (planId === "enterprise") {
      window.location.href =
        "mailto:sales@viona.dev?subject=Enterprise%20Plan%20Inquiry";
      return;
    }

    if (planId === "free") {
      handleManageBilling();
      return;
    }

    setCheckoutLoading(planId);
    try {
      const result = await createCheckoutSession(selectedOrgId, planId);
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!selectedOrgId) return;
    setPortalLoading(true);
    try {
      const result = await createBillingPortalSession(selectedOrgId);
      if (result.url) {
        window.location.href = result.url;
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  };

  if (orgs.length === 0 || !selectedOrgId) {
    return (
      <OrganizationState 
        hasOrganizations={orgs.length > 0} 
        hasSelectedOrg={!!selectedOrgId}
        orgs={orgs}
        selectedOrgId={selectedOrgId}
        onOrganizationSelect={setSelectedOrgId}
      />
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-8">
      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <Card className="h-24 bg-muted/40 rounded-2xl" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="h-[400px] bg-muted/40 rounded-2xl" />
            ))}
          </div>
          <Card className="h-40 bg-muted/40 rounded-2xl" />
        </div>
      ) : subscription ? (
        <div className="space-y-8 max-w-6xl mx-auto">
          <CurrentPlanBanner
            planName={subscription.planName}
            status={subscription.status}
            price={subscription.price}
            currentPeriodEnd={subscription.currentPeriodEnd}
            cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
            onManageBilling={handleManageBilling}
            loading={portalLoading}
            hasStripeCustomer={!!subscription.stripeCustomerId}
          />

          <div>
            <h2 className="text-xl font-semibold mb-4">Plans & Pricing</h2>
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <PricingCard
                  key={plan.id}
                  name={plan.name}
                  price={plan.price}
                  features={plan.features}
                  isCurrentPlan={subscription.plan === plan.id}
                  isPopular={plan.id === "pro"}
                  onSelect={() => handleSelectPlan(plan.id)}
                  loading={checkoutLoading === plan.id}
                  currentPlan={subscription.plan}
                />
              ))}
            </div>
          </div>

          <UsageOverview usage={subscription.usage} />
        </div>
      ) : (
        <Card className="p-8 text-center rounded-2xl max-w-md mx-auto">
          <p className="text-muted-foreground">
            Unable to load billing information. Please try again.
          </p>
          <Button onClick={loadData} className="mt-4">
            Retry
          </Button>
        </Card>
      )}
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 p-6 space-y-6 animate-pulse">
          <Card className="h-24 bg-muted/40 rounded-2xl" />
          <div className="grid gap-4 grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="h-[400px] bg-muted/40 rounded-2xl" />
            ))}
          </div>
        </div>
      }
    >
      <BillingPageContent />
    </Suspense>
  );
}
