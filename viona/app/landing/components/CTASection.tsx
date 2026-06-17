"use client";

import React from "react";
import { ArrowRight, CheckCircle } from "lucide-react";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { motion } from "motion/react";

interface CTASectionProps {
  onGetStarted: () => void;
}

const CTASection: React.FC<CTASectionProps> = ({ onGetStarted }) => {
  const benefits: string[] = [
    "Real-time Inventory Tracking",
    "Multi-Warehouse Support",
    "Granular Role Permissions",
    "Autonomous AI Workflows",
  ];

  return (
    <section className="py-24 relative w-full overflow-hidden bg-black">
      {/* Background Beams */}
      <BackgroundBeams className="opacity-30" />



      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Main CTA */}
          <div className="space-y-10">
            <div className="space-y-6">
              <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1]">
                Ready to transform your <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                  Business operations?
                </span>
              </h2>
              <p className="text-lg md:text-xl text-neutral-300 max-w-2xl mx-auto">
                Join leading businesses using Viona Pro to manage inventory, process orders, and orchestrate autonomous AI workflows.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={onGetStarted}
                className="h-14 px-8 inline-flex items-center justify-center font-medium rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 transition-all text-lg group shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
              >
                Join Viona Pro
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button className="h-14 px-8 text-neutral-300 hover:text-white bg-white/5 border border-white/5 rounded-lg transition-colors text-lg font-medium">
                Talk to Sales
              </button>
            </div>

            {/* Benefits List */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 pt-8">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center text-sm text-neutral-500"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-500 mr-2 opacity-80" />
                  {benefit}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
