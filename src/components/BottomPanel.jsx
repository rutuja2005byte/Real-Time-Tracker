import { motion } from "framer-motion";
import { Clock, MapPin } from "lucide-react";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(timestamp) {
  if (!timestamp) return "waiting";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(seconds) < 60) return rtf.format(seconds, "second");
  return rtf.format(Math.round(seconds / 60), "minute");
}

function formatDistance(distance) {
  if (!Number.isFinite(distance)) return "Waiting";
  if (distance < 5) return "Here";
  if (distance < 1000) return `${Math.round(distance)} m away`;
  return `${(distance / 1000).toFixed(2)} km away`;
}

export function BottomPanel({ users }) {
  const onlineCount = users.filter((user) => user.online).length;

  return (
    <motion.section
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 22 }}
      className="absolute inset-x-3 bottom-3 z-[500] mx-auto max-w-xl rounded-3xl border border-white/15 bg-black/70 p-4 text-white shadow-2xl shadow-black/45 backdrop-blur-2xl sm:bottom-5"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">People nearby</h2>
          <p className="text-sm text-zinc-300">{onlineCount} online</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
          {users.length}
        </span>
      </div>

      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-sm text-zinc-300">
            Waiting for users to share location.
          </div>
        ) : (
          users.map((user) => (
            <motion.div
              layout
              key={user.id}
              className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] p-3"
            >
              <span
                className="h-10 w-10 rounded-full border-2 border-white/70 shadow-lg"
                style={{ backgroundColor: user.online ? user.color : "#646b78" }}
              />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold">{user.name}</p>
                  <span className="shrink-0 text-xs text-zinc-300">
                    {user.isSelf ? "You" : user.online ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {user.isSelf ? "Your location" : formatDistance(user.distanceFromMe)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={13} /> {relativeTime(user.lastUpdate)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.section>
  );
}
