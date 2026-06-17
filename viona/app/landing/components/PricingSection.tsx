"use client";

import React, { useState } from "react";
import { Check, Star, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface PricingSectionProps {
  onGetStarted?: () => void;
}

interface Plan {
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  popular: boolean;
  buttonText: string;
}

const PricingSection: React.FC<PricingSectionProps> = ({ onGetStarted }) => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans: Plan[] = [
    {
      name: "Starter",
      description: "Perfect for small businesses getting started",
      monthlyPrice: 29,
      annualPrice: 24,
      features: [
        "Up to 5 team members",
        "Basic analytics dashboard",
        "Real-time data sync",
        "Email support",
      ],
      popular: false,
      buttonText: "Start Free Trial",
    },
    {
      name: "Professional",
      description: "For growing teams that need advanced features",
      monthlyPrice: 99,
      annualPrice: 65,
      features: [
        "Up to 25 team members",
        "Advanced analytics & AI insights",
        "Custom dashboards",
        "Priority support",
        "Workflow automation",
      ],
      popular: true,
      buttonText: "Start Free Trial",
    },
    {
      name: "Enterprise",
      description: "For large organizations with custom needs",
      monthlyPrice: 199,
      annualPrice: 165,
      features: [
        "Unlimited team members",
        "Full AI-powered analytics suite",
        "Dedicated account manager",
        "Custom integrations",
        "SLA guarantee",
      ],
      popular: false,
      buttonText: "Contact Sales",
    },
  ];

  return (
    <section id="pricing" className="py-24 relative w-full bg-[#09090b]">
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Predictable pricing for <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">unpredictable growth</span>
          </h2>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-white/5 rounded-full p-1 border border-white/10 mt-6">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-300 ${
                !isAnnual
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-300 ${
                isAnnual
                  ? "bg-white text-black shadow-sm"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Annual <span className="text-neutral-500 hidden sm:inline">(Save 20%)</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index, duration: 0.5 }}
              viewport={{ once: true }}
              className={`relative ${plan.popular ? "lg:-translate-y-4" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500 text-white shadow-sm">
                    <Star className="w-3 h-3 mr-1 fill-current" />
                    Most Popular
                  </div>
                </div>
              )}

              <div
                className={`rounded-3xl p-8 border transition-all duration-300 flex flex-col h-full bg-[#18181b] ${
                  plan.popular
                    ? "border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-2xl shadow-emerald-500/10"
                    : "border-white/5 hover:border-white/10 hover:shadow-2xl hover:shadow-cyan-500/5 group"
                }`}
              >
                {/* Plan Header */}
                <div className="mb-8">
                  <h3 className="text-lg font-medium text-white mb-2">{plan.name}</h3>
                  <p className="text-neutral-400 text-sm h-10">
                    {plan.description}
                  </p>

                  <div className="mt-6 flex items-baseline">
                    <span className="text-5xl font-bold tracking-tight text-white">
                      ${isAnnual ? plan.annualPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-neutral-500 text-sm ml-2">/month</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-4 flex-1 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start">
                      <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mr-3" />
                      <span className="text-sm text-neutral-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={plan.name === "Enterprise" ? undefined : onGetStarted}
                  className={`w-full inline-flex items-center justify-center px-6 py-4 text-sm font-semibold rounded-xl transition-all group ${
                    plan.popular
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                      : "bg-white/5 border border-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
