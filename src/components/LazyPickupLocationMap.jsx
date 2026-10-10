import { lazy, Suspense } from 'react'

const PickupLocationMap = lazy(() => import('./PickupLocationMap'))

export default function LazyPickupLocationMap(props) {
  return (
    <Suspense fallback={<div className="flex h-72 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-500">Loading map…</div>}>
      <PickupLocationMap {...props} />
    </Suspense>
  )
}
