import { Logo } from '@/components/Logo'
import { AuthDashboardPreview } from '@/components/AuthDashboardPreview'
import React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full bg-[#0a0a0a] overflow-hidden">
      
      {/* Left Panel: Auth Form */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 bg-[#0d0d0d] relative z-10 border-r border-[#1a1a1a]">
        <div className="max-w-md w-full mx-auto space-y-8">
          
          {/* Brand heading */}
          <div className="space-y-1">
            <Logo fontSize="text-2xl" />
            <h1 className="text-3xl font-bold text-white tracking-tight">Your smart business partner</h1>
          </div>

          {/* Auth form slot */}
          <div className="w-full">
            {children}
          </div>

          {/* Footer */}
          <p className="text-[11px] text-white/20 text-center">
            &copy; 2025 Gudanta. All rights reserved.
          </p>

        </div>
      </div>

      {/* Right Panel: Feature Preview */}
      <div className="hidden lg:flex flex-1 flex-col items-center justify-center bg-[#0a0a0a] relative p-12 overflow-hidden">
        
        {/* Glow blobs */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Logo top center — matches reference exactly */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <Logo fontSize="text-xl" />
        </div>

        {/* Dashboard card, vertically centered */}
        <div className="relative z-10 w-full flex items-center justify-center">
          <AuthDashboardPreview />
        </div>

      </div>
    </div>
  )
}