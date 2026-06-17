"use client"
import React from 'react'
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb"

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MobileSidebar } from './DesktopSidebar'

export const BreadcrumbHeader = () => {
    const pathname = usePathname();

    // Build cumulative breadcrumb entries so each link points to the full
    // path up to and including that segment, not just the bare segment.
    //
    // Example — pathname = "/storage/organization/starck/productimage"
    //
    //   index  segment          href (cumulative)
    //   0      ""  → Dashboard  /
    //   1      storage          /storage
    //   2      organization     /storage/organization   ← correct!
    //   3      starck           /storage/organization/starck
    //   4      productimage     /storage/organization/starck/productimage
    //
    const segments = pathname === '/' ? [''] : pathname.split('/');

    const breadcrumbs = segments.map((segment, index) => {
        // Cumulative href = join all segments up to this index
        const href = index === 0
            ? '/'
            : '/' + segments.slice(1, index + 1).join('/');

        const label = segment === '' ? 'Dashboard' : decodeURIComponent(segment);

        return { href, label };
    });

    return (
        <div className='flex items-center justify-between w-full p-3 bg-background md:justify-start'>
            <div className='flex items-center gap-4'>
                <MobileSidebar />
                <Breadcrumb>
                    <BreadcrumbList>
                        {breadcrumbs.map((crumb, index) => (
                            <React.Fragment key={index}>
                                <BreadcrumbItem>
                                    <BreadcrumbLink asChild className='capitalize'>
                                        <Link href={crumb.href}>{crumb.label}</Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
                            </React.Fragment>
                        ))}
                    </BreadcrumbList>
                </Breadcrumb>
            </div>
        </div>
    )
}