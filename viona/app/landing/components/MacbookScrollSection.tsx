"use client";

import React from "react";
import { MacbookScroll } from "@/components/ui/macbook-scroll";
import { LayoutTextFlip } from "@/components/ui/layout-text-flip";

const MacbookScrollSection: React.FC = () => {
  return (
    <section className="relative w-full bg-[#09090b] overflow-hidden -mt-20 md:-mt-32 pb-20">
      {/* Background ambient glow to anchor the macbook */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[400px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      <MacbookScroll
        title={
          <div className="mb-6">
            <LayoutTextFlip 
              text="Experience the power of"
              words={["Inventory Management", "Order Fulfillment", "AI Agents", "Workflow Automation"]}
              textClassName="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400"
              wordClassName="dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
            />
          </div>
        }
        src="/image.png"
        showGradient={false}
      />
    </section>
  );
};

export default MacbookScrollSection;
