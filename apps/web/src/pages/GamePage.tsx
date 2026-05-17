import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProgress } from '@react-three/drei'
import BoardScene, { type CameraDebugInfo } from '../scenes/BoardScene'

function LoadingOverlay({ active, progress }: { active: boolean; progress: number }) {
  if (!active) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/80 px-6 py-5 text-slate-100 shadow-xl">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-400 border-t-cyan-300" />
        <p className="text-sm font-medium">Loading board... {Math.round(progress)}%</p>
      </div>
    </div>
  )
}

function DevMenu({ info }: { info: CameraDebugInfo | null }) {
  if (!info) {
    return (
      <div className="rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 text-xs text-slate-200 backdrop-blur-sm">
        Waiting for camera data...
      </div>
    )
  }

  return (
    <div className="w-[300px] rounded-xl border border-white/15 bg-slate-950/85 p-4 text-xs text-slate-100 shadow-2xl backdrop-blur-sm">
      <p className="text-sm font-semibold text-cyan-300">Dev Camera Menu</p>
      <p className="mt-1 text-[11px] text-slate-400">Toggle: F3</p>
      <div className="mt-3 space-y-1 font-mono">
        <p>
          Position: [{info.position.x}, {info.position.y}, {info.position.z}]
        </p>
        <p>
          Rotation(deg): [{info.rotationDeg.x}, {info.rotationDeg.y}, {info.rotationDeg.z}]
        </p>
        <p>
          Target: [{info.target.x}, {info.target.y}, {info.target.z}]
        </p>
        <p>Distance to target: {info.distanceToTarget}</p>
        <p>FOV: {info.fov ?? 'n/a'}</p>
        <p>Zoom: {info.zoom}</p>
        <p>Near/Far: {info.near} / {info.far}</p>
        <p>Polar angle(deg): {info.polarAngleDeg ?? 'n/a'}</p>
        <p>Azimuth angle(deg): {info.azimuthAngleDeg ?? 'n/a'}</p>
        <p>DPR: {info.dpr}</p>
      </div>
    </div>
  )
}

export default function GamePage() {
  const { active, progress } = useProgress()
  const [showDevMenu, setShowDevMenu] = useState(false)
  const [cameraDebugInfo, setCameraDebugInfo] = useState<CameraDebugInfo | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F3') {
        return
      }

      event.preventDefault()
      setShowDevMenu((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-950">
      <BoardScene onDebugInfoChange={setCameraDebugInfo} />

      <div className="absolute left-4 top-4 z-30">
        <Link
          to="/"
          className="inline-flex items-center rounded-lg border border-white/20 bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/50"
        >
          Back
        </Link>
      </div>

      {showDevMenu ? (
        <div className="absolute right-4 top-4 z-30">
          <DevMenu info={cameraDebugInfo} />
        </div>
      ) : null}

      <LoadingOverlay active={active} progress={progress} />
    </div>
  )
}
