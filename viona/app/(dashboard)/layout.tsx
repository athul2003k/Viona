import DesktopSidebar from "@/components/DesktopSidebar";
import React from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DesktopSidebar />
      <div className="flex flex-col  flex-1 min-w-0 min-h-0 transition-all duration-200 ease-in-out">
        <DashboardHeader />
        <div className="overflow-auto flex-1 flex flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex flex-col flex-1 w-full min-h-full text-accent-foreground">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
