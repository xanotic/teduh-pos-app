"use client";

export function QrModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-surface p-5 shadow-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className="max-h-[70vh] w-full rounded-lg object-contain" />
        <p className="text-center text-sm font-bold text-ink">{label}</p>
        <button
          onClick={onClose}
          className="rounded-lg bg-accent px-5 py-2 text-xs font-bold text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
