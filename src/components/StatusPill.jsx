const toneMap = {
  connected: "border-emerald-400/30 bg-emerald-400/15 text-emerald-100",
  active: "border-emerald-400/30 bg-emerald-400/15 text-emerald-100",
  connecting: "border-amber-300/30 bg-amber-300/15 text-amber-100",
  reconnecting: "border-amber-300/30 bg-amber-300/15 text-amber-100",
  locating: "border-sky-300/30 bg-sky-300/15 text-sky-100",
  offline: "border-rose-400/30 bg-rose-400/15 text-rose-100",
  error: "border-rose-400/30 bg-rose-400/15 text-rose-100",
};

export function StatusPill({ label, value }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize backdrop-blur-xl ${toneMap[value] ?? toneMap.offline}`}
    >
      <span className="h-2 w-2 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
      {label}: {value}
    </span>
  );
}
