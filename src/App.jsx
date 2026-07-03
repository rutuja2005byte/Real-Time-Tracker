import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, LocateFixed, RefreshCw, UserRound } from "lucide-react";
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
  const [profileName, setProfileName] = useState(() => {
    return localStorage.getItem("tracker-profile-name") || "User";
  });
  const { activeUsers, locationStatus, permissionError, reconnect, socketStatus } =
    useRealtimeTracker(profileName.trim() || "User");

  const isLoading = activeUsers.length === 0 && locationStatus !== "error";

  useEffect(() => {
    localStorage.setItem("tracker-profile-name", profileName.trim() || "User");
  }, [profileName]);

  return (
    <main className="relative h-full min-h-full overflow-hidden bg-[#07090d] text-white">
      <TrackingMap ref={mapControlsRef} users={activeUsers} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-40 bg-gradient-to-b from-black/70 to-transparent" />

      <header className="absolute left-3 right-3 top-3 z-[600] flex flex-col gap-3 sm:left-5 sm:right-5 sm:top-5 sm:flex-row sm:items-start sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-3xl border border-white/12 bg-black/70 p-4 shadow-2xl shadow-black/35 backdrop-blur-2xl"
        >
          <h1 className="text-xl font-bold">Live Location</h1>
          <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
            <UserRound size={18} className="text-zinc-300" />
            <input
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="w-full bg-transparent text-sm font-medium text-white outline-none placeholder:text-zinc-500"
              placeholder="Enter your name"
              maxLength={32}
            />
          </label>
        </motion.div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <StatusPill label="Socket" value={socketStatus} />
          <StatusPill label="GPS" value={locationStatus} />
        </div>
      </header>

      <div className="absolute right-3 top-44 z-[600] flex flex-col gap-3 sm:right-5 sm:top-32">
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
            <div className="rounded-3xl border border-white/12 bg-black/75 px-6 py-5 shadow-2xl backdrop-blur-2xl">
              <div className="mx-auto mb-4 h-11 w-11 animate-spin rounded-full border-2 border-white/20 border-t-orange-400" />
              <p className="text-lg font-bold">Finding your location</p>
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
