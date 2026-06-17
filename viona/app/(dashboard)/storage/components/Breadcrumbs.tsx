import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BreadcrumbsProps {
    items: { label: string; href: string }[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className="flex items-center gap-1 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors p-1 rounded-md hover:bg-white/5">
                <Home className="w-4 h-4" />
            </Link>
            {items.map((item, index) => (
                <div key={item.href} className="flex items-center gap-1">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                    <Link
                        href={item.href}
                        className={cn(
                            "px-2 py-1 rounded-md transition-colors",
                            index === items.length - 1
                                ? "text-white font-medium bg-white/5"
                                : "hover:text-white hover:bg-white/5"
                        )}
                    >
                        {item.label}
                    </Link>
                </div>
            ))}
        </nav>
    );
}
