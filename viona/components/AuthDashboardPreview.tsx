"use client";

import React from "react";
import { FileSpreadsheet, TrendingUp, ShoppingBag, CheckCircle2, DollarSign } from "lucide-react";

export const AuthDashboardPreview = () => {
  return (
    <div className="relative w-full max-w-2xl bg-[#0f0f0f] border border-[#1a1a1a] rounded-3xl p-12 shadow-2xl overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative flex items-center justify-between gap-12">
        {/* Left: Source Icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl flex items-center justify-center shadow-xl transform transition-transform group-hover:scale-105 duration-500">
            <FileSpreadsheet className="w-12 h-12 text-emerald-500" />
          </div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-widest">Source Data</p>
        </div>

        {/* Middle: Connection Lines */}
        <div className="flex-1 relative h-32 flex items-center">
            <svg className="w-full h-full absolute inset-0 pointer-events-none opacity-20">
                <path d="M0,64 Q100,64 120,32" stroke="white" strokeWidth="1" fill="none" className="animate-pulse" />
                <path d="M0,64 Q100,64 120,96" stroke="white" strokeWidth="1" fill="none" className="animate-pulse" />
            </svg>
        </div>

        {/* Right: Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 w-2/3">
          {/* Card 1 */}
          <div className="bg-[#121212] border border-[#1a1a1a] p-5 rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <ShoppingBag className="w-4 h-4 text-stone-500" />
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-bold">+14%</span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium mb-1">Total stock available</p>
            <h4 className="text-xl font-bold text-white">2,745</h4>
          </div>

          {/* Card 2 */}
          <div className="bg-[#121212] border border-[#1a1a1a] p-5 rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <TrendingUp className="w-4 h-4 text-stone-500" />
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-bold">+25</span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium mb-1">Total orders</p>
            <h4 className="text-xl font-bold text-white">482</h4>
          </div>

          {/* Card 3 */}
          <div className="bg-[#121212] border border-[#1a1a1a] p-5 rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <CheckCircle2 className="w-4 h-4 text-stone-500" />
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-bold">0.27%</span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium mb-1">Delivery success rate</p>
            <h4 className="text-xl font-bold text-white">96,72%</h4>
          </div>

          {/* Card 4 */}
          <div className="bg-[#121212] border border-[#1a1a1a] p-5 rounded-2xl shadow-lg hover:border-emerald-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <DollarSign className="w-4 h-4 text-stone-500" />
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-bold">+33k</span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium mb-1">Revenue generated</p>
            <h4 className="text-xl font-bold text-white">$ 245k</h4>
          </div>
        </div>
      </div>
    </div>
  );
};
