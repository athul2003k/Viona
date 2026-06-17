"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onGetStarted }) => {
  return (
    <section className="relative w-full min-h-screen bg-[#09090b] overflow-hidden pt-24 pb-16 flex flex-col justify-between">
      
      {/* Sharp Diagonal Emerald Background Graphics mimicking reference but in green */}
      <div className="absolute top-0 right-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <motion.div 
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 0.6, x: 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute -right-[10%] top-[10%] w-[100%] h-[150%] bg-[#064e3b]" // emerald-900 equivalent
          style={{ transform: "rotate(-35deg) translateY(-20%)" }}
        />
        <motion.div 
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 0.8, x: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="absolute -right-[5%] top-[15%] w-[80%] h-[150%] bg-[#047857]" // emerald-700
          style={{ transform: "rotate(-35deg) translateY(-20%)" }}
        />
        <motion.div 
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="absolute right-[0%] top-[20%] w-[60%] h-[150%] bg-[#10b981]" // emerald-500
          style={{ transform: "rotate(-35deg) translateY(-20%)" }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex-grow flex flex-col justify-center">
        
        {/* Left Aligned Content */}
        <div className="max-w-3xl mt-12 md:mt-24">
          
          {/* Top Pill */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 backdrop-blur-md mb-8 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            Introducing autonomous AI workflows
            <ArrowRight className="ml-2 w-3 h-3 text-emerald-400" />
          </motion.div>
          
          {/* Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1]"
          >
            Automate your entire business with <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              AI that never sleeps.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-neutral-300 max-w-2xl leading-relaxed mb-10 font-medium"
          >
            The intelligent ERP and management platform that unifies your inventory, orders, team workspaces, and autonomous AI workflows.
          </motion.p>

          {/* Buttons */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 items-start"
          >
            <button
              onClick={onGetStarted}
              className="inline-flex items-center justify-center px-6 py-3.5 text-base font-semibold rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)]"
            >
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
            <button className="inline-flex items-center justify-center px-6 py-3.5 text-base font-medium rounded-lg text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors">
              Learn More
            </button>
          </motion.div>
        </div>
      </div>
      
    </section>
  );
};

export default HeroSection;