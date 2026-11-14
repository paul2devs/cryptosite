import { Panel, SkeletonBlock } from "../dashboard/primitives";

export function DepositLoadingSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <SkeletonBlock key={index} className="h-6 w-16 shrink-0 rounded-full" />
          ))}
        </div>
        <Panel className="space-y-4">
          <SkeletonBlock className="h-3 w-28" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonBlock key={index} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </Panel>
        <SkeletonBlock className="h-11 w-full rounded-xl" />
      </div>
      <Panel className="space-y-5">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-16 w-full rounded-xl" />
        <SkeletonBlock className="mx-auto h-44 w-44 rounded-2xl" />
        <SkeletonBlock className="h-12 w-full rounded-xl" />
      </Panel>
    </div>
  );
}
