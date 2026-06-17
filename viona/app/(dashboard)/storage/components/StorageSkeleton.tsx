// app/(dashboard)/storage/components/StorageSkeleton.tsx

export function StorageSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="flex-1 min-h-0 pb-10 bg-card rounded-xl border border-border mt-4 overflow-hidden">
        {/* List skeleton — 8 rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0 animate-pulse"
          >
            {/* Icon placeholder */}
            <div className="w-8 h-8 rounded-md bg-muted shrink-0" />
            {/* Name placeholder */}
            <div
              className="flex-1 h-4 rounded bg-muted"
              style={{ maxWidth: `${40 + (i % 4) * 15}%` }}
            />
            {/* Size placeholder */}
            <div className="w-14 h-3 rounded bg-muted hidden sm:block" />
            {/* Date placeholder */}
            <div className="w-20 h-3 rounded bg-muted hidden md:block" />
          </div>
        ))}
      </div>
    );
  }

  // Grid skeleton
  return (
    <div className="space-y-8 pb-10">
      {/* Folders section */}
      <section>
        <br />
        {/* Section label placeholder */}
        <div className="h-4 w-16 rounded bg-muted mb-4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>

      {/* Files section */}
      <section>
        {/* Section label placeholder */}
        <div className="h-4 w-12 rounded bg-muted mb-4 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </section>
    </div>
  );
}
