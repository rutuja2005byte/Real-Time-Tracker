import { useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, LocateFixed, RefreshCw } from "lucide-react";
import { BottomPanel } from "./components/BottomPanel.jsx";
import { StatusPill } from "./components/StatusPill.jsx";
import { TrackingMap } from "./components/TrackingMap.jsx";
import { useRealtimeTracker } from "./hooks/useRealtimeTracker.js";

function FloatingButton({ label, icon: Icon, onClick, tone = "default" }) {
  const tones = {
    default: "border-white/15 bg-zinc-950/70 text-white hover:bg-white/15",
    accent: "border-orange-300/30 bg-orange-500 text-white hover:bg-orange-400",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex h-12 w-12 items-center justify-center rounded-2xl border shadow-xl shadow-black/35 backdrop-blur-xl transition ${tones[tone]}`}
      aria-label={label}
      title={label}
    >
      <Icon size={20} className="transition group-active:scale-90" />
    </button>
  );
}

export default function App() {
  const mapControlsRef = useRef(null);
  const { activeUsers, locationStatus, permissionError, reconnect, socketStatus } =
    useRealtimeTracker();

  const isLoading = activeUsers.length === 0 && locationStatus !== "error";

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-[#07090d] text-white">
      <TrackingMap ref={mapControlsRef} users={activeUsers} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-48 bg-gradient-to-b from-black/75 via-black/30 to-transparent" />

      <header className="absolute left-3 right-3 top-3 z-[600] flex flex-col gap-3 sm:left-5 sm:right-5 sm:top-5 sm:flex-row sm:items-start sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md rounded-[26px] border border-white/12 bg-zinc-950/55 px-4 py-3 shadow-2xl shadow-black/35 backdrop-blur-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">
            Realtime Tracker
          </p>
          <h1 className="mt-1 text-2xl font-black tracking-normal sm:text-3xl">
            Live location map
          </h1>
        </motion.div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <StatusPill label="Socket" value={socketStatus} />
          <StatusPill label="GPS" value={locationStatus} />
        </div>
      </header>

      <div className="absolute right-3 top-40 z-[600] flex flex-col gap-3 sm:right-5 sm:top-36">
        <FloatingButton
          label="My Location"
          icon={LocateFixed}
          onClick={() => mapControlsRef.current?.focusSelf()}
          tone="accent"
        />
        <FloatingButton
          label="Focus All"
          icon={Crosshair}
          onClick={() => mapControlsRef.current?.focusAll()}
        />
        <FloatingButton label="Reconnect" icon={RefreshCw} onClick={reconnect} />
      </div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[550] grid place-items-center bg-black/35 px-6 text-center backdrop-blur-[2px]"
          >
            <div className="rounded-[28px] border border-white/12 bg-zinc-950/75 px-6 py-5 shadow-2xl backdrop-blur-2xl">
              <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-2 border-white/20 border-t-orange-400" />
              <p className="text-lg font-bold">Finding your live location</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-300">
                Allow location access to start sharing updates with the map.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {permissionError && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            className="absolute left-3 right-3 top-36 z-[650] mx-auto max-w-md rounded-2xl border border-rose-300/25 bg-rose-950/80 p-4 text-sm text-rose-50 shadow-2xl backdrop-blur-xl sm:top-28"
          >
            {permissionError}
          </motion.div>
        )}
      </AnimatePresence>

      <BottomPanel users={activeUsers} />
    </main>
  );
}
