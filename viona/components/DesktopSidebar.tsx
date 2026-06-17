"use client";
import React, { useMemo, useCallback } from "react";
import {
  Package,
  Layers2Icon,
  ShieldCheckIcon,
  CoinsIcon,
  MenuIcon,
  ChevronLeft,
  ChevronRight,
  Logs,
  Blocks,
  LayoutDashboard,
  GitBranch,
  Building2,
  Warehouse,
  MessageCircle,
  HardDrive,
  LucideIcon,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import Link from "next/link";
import { Button, buttonVariants } from "./ui/button";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { UsageMeter } from "./UsageMeter";
import { useSidebarStore } from "@/hooks/useSidebarStore";
import { useCurrentOrgRole } from "@/hooks/useOrgStore";
import { useState } from "react";

const routes = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: Logs },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/warehouse", label: "Warehouse", icon: Warehouse },
  { href: "/employees", label: "Employees", icon: Users, roles: ["admin", "manager"] as string[] },
  { href: "/workflows", label: "Workflows", icon: Layers2Icon, roles: ["admin", "manager"] as string[] },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/credentials", label: "Credentials", icon: ShieldCheckIcon, roles: ["admin", "manager"] as string[] },
  { href: "/billing", label: "Billing", icon: CoinsIcon, roles: ["admin", "manager"] as string[] },
  { href: "/organization", label: "Organization", icon: Building2 },
  { href: "/storage", label: "Storage", icon: HardDrive },
];

// Memoized sidebar link to prevent re-renders when other links change
const SidebarLink = React.memo(function SidebarLink({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const linkElement = (
    <Link
      href={href}
      className={`${buttonVariants({
        variant: isActive ? "sidebarActiveItem" : "sidebarItem",
      })} ${isCollapsed ? "justify-center px-2" : "justify-start"} transition-colors duration-150 flex items-center`}
      prefetch
    >
      <Icon size={20} className="shrink-0 flex-none" />
      <span
        className={`ml-2 transition-opacity duration-200 ${
          isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
        }`}
      >
        {label}
      </span>
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkElement;
});

const DesktopSidebar = () => {
  const { isCollapsed, toggle } = useSidebarStore();
  const pathname = usePathname();
  const role = useCurrentOrgRole();

  const visibleRoutes = useMemo(() => {
    return routes.filter(r => !r.roles || (role && r.roles.includes(role)));
  }, [role]);

  // Memoized active route calculation
  const activeRoute = useMemo(() => {
    return (
      visibleRoutes.find((route) => {
        if (route.href === "/") {
          return pathname === "/";
        }
        return pathname === route.href || pathname.startsWith(route.href + "/");
      }) || visibleRoutes[0]
    );
  }, [pathname, visibleRoutes]);

  return (
    <TooltipProvider>
      <div
        className="hidden relative md:flex flex-col h-screen overflow-hidden bg-primary/5 dark:bg-secondary/30 dark:text-foreground text-muted-foreground border-r-2 border-separate shrink-0"
        style={{
          width: isCollapsed ? "65px" : "240px",
          transition: "width 0.2s ease-in-out",
        }}
      >
        {/* Top section with logo + collapse button */}
        <div
          className={`flex items-center ${
            isCollapsed ? "justify-center" : "justify-between"
          } gap-2 border-b-[1px] border-separate p-4`}
        >
          <div
            className={`transition-opacity duration-200 ${
              isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}
          >
            <Logo />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="shrink-0 flex-none"
          >
            {isCollapsed ? (
              <ChevronRight size={20} />
            ) : (
              <ChevronLeft size={20} />
            )}
          </Button>
        </div>

        {/* Sidebar links */}
        <div className="flex flex-col p-2 flex-1">
          {visibleRoutes.map((route) => (
            <SidebarLink
              key={route.href}
              href={route.href}
              label={route.label}
              icon={route.icon}
              isActive={activeRoute.href === route.href}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>

        {/* Usage Meter at bottom */}
        <UsageMeter isCollapsed={isCollapsed} />
      </div>
    </TooltipProvider>
  );
};

export function MobileSidebar() {
  const [isOpen, setOpen] = useState(false);
  const pathname = usePathname();
  const role = useCurrentOrgRole();

  const visibleRoutes = useMemo(() => {
    return routes.filter(r => !r.roles || (role && r.roles.includes(role)));
  }, [role]);

  const activeRoute = useMemo(() => {
    return (
      visibleRoutes.find((route) => {
        if (route.href === "/") {
          return pathname === "/";
        }
        return pathname === route.href || pathname.startsWith(route.href + "/");
      }) || visibleRoutes[0]
    );
  }, [pathname, visibleRoutes]);

  return (
    <div className="md:hidden">
      <Sheet open={isOpen} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant={"ghost"} size={"icon"}>
            <MenuIcon />
          </Button>
        </SheetTrigger>
        <SheetContent
          className="w-[280px] sm:w-[320px] space-y-4"
          side={"left"}
        >
          <Logo />
          <div className="flex flex-col gap-1 flex-1">
            {visibleRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={buttonVariants({
                  variant:
                    activeRoute.href === route.href
                      ? "sidebarActiveItem"
                      : "sidebarItem",
                })}
                onClick={() => setOpen(false)}
              >
                <route.icon size={20} />
                {route.label}
              </Link>
            ))}
          </div>
          <UsageMeter isCollapsed={false} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default DesktopSidebar;