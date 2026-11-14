import { Panel, SkeletonBlock } from "../dashboard/primitives";

export function WithdrawLoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Panel className="space-y-4">
          <SkeletonBlock className="h-3 w-24" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonBlock key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </Panel>
        <Panel className="space-y-4">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-14 w-full rounded-xl" />
          <SkeletonBlock className="h-14 w-full rounded-xl" />
        </Panel>
        <Panel className="space-y-4">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
          <SkeletonBlock className="h-24 w-full rounded-xl" />
          <SkeletonBlock className="h-10 w-40 rounded-full" />
        </Panel>
      </div>
      <div className="min-w-0 space-y-6">
        <Panel className="space-y-4">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
          <SkeletonBlock className="h-12 w-full rounded-xl" />
        </Panel>
        <Panel className="space-y-4">
          <SkeletonBlock className="h-3 w-36" />
          <SkeletonBlock className="h-16 w-full rounded-xl" />
          <SkeletonBlock className="h-16 w-full rounded-xl" />
        </Panel>
      </div>
    </div>
  );
}
