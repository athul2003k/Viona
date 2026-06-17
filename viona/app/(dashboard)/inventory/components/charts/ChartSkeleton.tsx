export default function ChartSkeleton({ height = 300 }: { height?: number }) {
  return <div className="rounded bg-muted animate-pulse" style={{ height }} />;
}
