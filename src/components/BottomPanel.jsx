import { motion } from "framer-motion";
import { Clock, Gauge, Navigation } from "lucide-react";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(timestamp) {
  if (!timestamp) return "waiting";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return rtf.format(seconds, "second");
  return rtf.format(Math.round(seconds / 60), "minute");
}

function formatSpeed(speed) {
  if (!Number.isFinite(speed)) return "0 km/h";
  return `${Math.max(0, speed * 3.6).toFixed(1)} km/h`;
}

export function BottomPanel({ users }) {
  const onlineCount = users.filter((user) => user.online).length;

  return (
    <motion.section
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 22 }}
      className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-3xl rounded-[28px] border border-white/15 bg-zinc-950/62 p-4 text-white shadow-2xl shadow-black/45 backdrop-blur-2xl sm:bottom-5 sm:p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-200/80">
            Live Fleet
          </p>
          <h2 className="mt-1 text-xl font-bold">Tracking {onlineCount} online</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-right">
          <p className="text-xs text-zinc-300">Users</p>
          <p className="text-lg font-bold">{users.length}</p>
        </div>
      </div>

      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-zinc-300">
            Waiting for the first location update.
          </div>
        ) : (
          users.map((user) => (
            <motion.div
              layout
              key={user.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3"
            >
              <span
                className="h-11 w-11 rounded-2xl border-2 border-white/70 shadow-lg"
                style={{ backgroundColor: user.online ? user.color : "#646b78" }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{user.name}</p>
                  <span
                    className={`h-2 w-2 rounded-full ${user.online ? "bg-emerald-300" : "bg-zinc-500"}`}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} /> {relativeTime(user.lastUpdate)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Gauge size={13} /> {formatSpeed(user.speed)}
                  </span>
                  {Number.isFinite(user.accuracy) && (
                    <span className="inline-flex items-center gap-1">
                      <Navigation size={13} /> +/- {Math.round(user.accuracy)}m
                    </span>
                  )}
                </div>
              </div>
              <span className="rounded-full bg-black/30 px-2.5 py-1 text-xs font-semibold text-zinc-200">
                {user.online ? "Online" : "Offline"}
              </span>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
