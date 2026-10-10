"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Staff, StaffPayout } from "@/lib/types";
import { fmt } from "@/lib/format";
import { formatTime12h } from "@/lib/happyHour";
import { QrModal } from "@/components/QrModal";
import {
  addStaff,
  createStaffPayout,
  deleteStaff,
  deleteStaffPayout,
  markStaffPayoutPaid,
  updateStaffRate,
  uploadStaffQr,
} from "./actions";

type PayMode = "lump" | "hourly";

// Minutes between a clock-in and clock-out time ("HH:MM" 24h strings),
// assuming an overnight shift (end earlier than start) rolls into the next day.
function minutesBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => isNaN(n))) return 0;
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

export function StaffPayoutClient({ staff, payouts }: { staff: Staff[]; payouts: StaffPayout[] }) {
  const [payMode, setPayMode] = useState<PayMode>("lump");
  const [staffId, setStaffId] = useState("");
  const [amount, setAmount] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [rate, setRate] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [enlargedQr, setEnlargedQr] = useState<{ url: string; label: string } | null>(null);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const selectedStaff = staffId ? staffById.get(staffId) : null;

  const owing = payouts.filter((p) => !p.paid).reduce((s, p) => s + Number(p.amount), 0);

  const hours = Math.round((minutesBetween(startTime, endTime) / 60) * 100) / 100;
  const hourlyTotal = hours * (parseFloat(rate) || 0);

  // Prefill the rate from the staff member's saved default whenever they're
  // picked in hourly mode — still freely editable per payout.
  useEffect(() => {
    if (payMode === "hourly" && selectedStaff?.hourly_rate != null) {
      setRate(String(selectedStaff.hourly_rate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId, payMode]);

  function handleSave() {
    if (payMode === "hourly") {
      const r = parseFloat(rate);
      if (!(hours > 0)) {
        setError("Set a clock-in and clock-out time.");
        return;
      }
      if (!(r > 0)) {
        setError("Enter a rate per hour greater than 0.");
        return;
      }
      setError(null);
      const shiftLabel = `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
      const fullNote = note.trim() ? `${shiftLabel} · ${note.trim()}` : shiftLabel;
      startTransition(async () => {
        try {
          await createStaffPayout({
            staffId: staffId || null,
            amount: hours * r,
            hours,
            hourlyRate: r,
            note: fullNote,
          });
          setStartTime("");
          setEndTime("");
          setNote("");
          setSavedMsg("Payout logged.");
          setTimeout(() => setSavedMsg(null), 2500);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save payout.");
        }
      });
      return;
    }

    const amt = parseFloat(amount);
    if (!(amt > 0)) {
      setError("Enter an amount greater than 0.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createStaffPayout({ staffId: staffId || null, amount: amt, note });
        setAmount("");
        setNote("");
        setSavedMsg("Payout logged.");
        setTimeout(() => setSavedMsg(null), 2500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save payout.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink">Pay Staff</h1>
      <p className="mb-5 text-sm text-ink-muted">
        Log a salary, advance, or bonus payout to a staff member — one lump sum, with their QR pay code
        handy to scan.
      </p>

      {owing > 0 && (
        <div className="mb-5 rounded-2xl border border-danger bg-danger-soft p-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-danger">Marked unpaid so far</div>
          <div className="text-lg font-extrabold text-danger">{fmt(owing)}</div>
        </div>
      )}

      <StaffManager staff={staff} />

      <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="mb-4 flex gap-1 rounded-xl bg-surface-alt p-1">
          <button
            type="button"
            onClick={() => setPayMode("lump")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
              payMode === "lump" ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            💵 Lump sum
          </button>
          <button
            type="button"
            onClick={() => setPayMode("hourly")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${
              payMode === "hourly" ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
            }`}
          >
            ⏱️ Hourly
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Staff
            </label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input">
              <option value="">— None —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {payMode === "lump" ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                Amount (RM)
              </label>
              <input
                type="number"
                step="0.1"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="input"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Clock in
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Clock out
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  Rate (RM/hr)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.00"
                  className="input"
                />
              </div>
            </>
          )}

          <div className={payMode === "hourly" ? "col-span-2 sm:col-span-3" : ""}>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. August salary"
              className="input"
            />
          </div>
        </div>

        {payMode === "hourly" && (startTime || endTime || rate) && (
          <div className="mb-3 flex items-center justify-between rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wide text-accent">
              {startTime && endTime ? `${formatTime12h(startTime)} – ${formatTime12h(endTime)} · ` : ""}
              {hours} hr{hours === 1 ? "" : "s"} × {fmt(parseFloat(rate) || 0)}/hr
            </span>
            <span className="text-lg font-extrabold text-accent">{fmt(hourlyTotal)}</span>
          </div>
        )}

        {selectedStaff?.qr_url && (
          <button
            type="button"
            onClick={() => setEnlargedQr({ url: selectedStaff.qr_url!, label: `${selectedStaff.name} QR pay code` })}
            className="mb-3 flex w-full items-center gap-2.5 rounded-lg border border-accent/40 bg-accent-soft p-2 text-left"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedStaff.qr_url}
              alt={`${selectedStaff.name} QR pay code`}
              className="h-16 w-16 cursor-zoom-in rounded-md object-cover"
            />
            <span className="text-xs font-bold text-accent">
              📱 Tap to enlarge — scan to pay {selectedStaff.name}
              {payMode === "hourly"
                ? hourlyTotal > 0
                  ? ` ${fmt(hourlyTotal)}`
                  : ""
                : amount && parseFloat(amount) > 0
                  ? ` ${fmt(parseFloat(amount))}`
                  : ""}
            </span>
          </button>
        )}
        {selectedStaff && !selectedStaff.qr_url && (
          <p className="mb-3 text-[11px] text-ink-muted">
            No QR pay code set for {selectedStaff.name} yet — add one above.
          </p>
        )}

        <button
          disabled={pending}
          onClick={handleSave}
          className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Log Payout"}
        </button>
        {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
        {savedMsg && <p className="mt-2 text-xs font-semibold text-success">{savedMsg}</p>}
      </div>

      <h2 className="mb-3 text-sm font-bold text-ink">Payout History</h2>
      <div className="flex flex-col gap-2">
        {payouts.map((p) => (
          <PayoutRow key={p.id} payout={p} staffName={p.staff_id ? staffById.get(p.staff_id)?.name ?? null : null} />
        ))}
        {payouts.length === 0 && <p className="text-sm text-ink-muted">No payouts logged yet.</p>}
      </div>

      {enlargedQr && <QrModal url={enlargedQr.url} label={enlargedQr.label} onClose={() => setEnlargedQr(null)} />}
    </div>
  );
}

function StaffManager({ staff }: { staff: Staff[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addStaff(name.trim(), rate === "" ? null : parseFloat(rate) || null);
        setName("");
        setRate("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add staff.");
      }
    });
  }

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <h2 className="text-sm font-bold text-ink">🧑‍🍳 Staff</h2>
          <p className="text-xs text-ink-muted">
            {staff.length === 0
              ? "Add your staff and their QR pay code for fast payouts."
              : `${staff.length} staff member${staff.length === 1 ? "" : "s"} set up.`}
          </p>
        </div>
        <span className="text-ink-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 border-t border-border pt-4">
          <form onSubmit={handleAdd} className="mb-3 flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staff name"
              className="input flex-1"
            />
            <input
              type="number"
              step="0.1"
              min={0}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="Rate RM/hr"
              title="Default hourly rate (optional) — prefills on the Hourly payout form"
              className="input w-28 flex-none"
            />
            <button
              disabled={pending}
              className="flex-none rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              + Add
            </button>
          </form>
          {error && <p className="mb-3 text-xs font-semibold text-danger">{error}</p>}

          <div className="flex flex-col gap-2">
            {staff.map((s) => (
              <StaffRow
                key={s.id}
                staff={s}
                confirmDelete={confirmDeleteId === s.id}
                onAskDelete={() => setConfirmDeleteId(s.id)}
                onCancelDelete={() => setConfirmDeleteId(null)}
              />
            ))}
            {staff.length === 0 && <p className="text-sm text-ink-muted">No staff yet.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function StaffRow({
  staff,
  confirmDelete,
  onAskDelete,
  onCancelDelete,
}: {
  staff: Staff;
  confirmDelete: boolean;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ratePending, startRateTransition] = useTransition();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      try {
        await uploadStaffQr(staff.id, fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function handleRateBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value.trim();
    const newRate = raw === "" ? null : parseFloat(raw) || null;
    if (newRate === staff.hourly_rate) return;
    setError(null);
    startRateTransition(async () => {
      try {
        await updateStaffRate(staff.id, newRate);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed — try again.");
        e.target.value = staff.hourly_rate != null ? String(staff.hourly_rate) : "";
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-bg px-3 py-2.5">
      {staff.qr_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staff.qr_url}
          alt={`${staff.name} QR pay code`}
          onClick={() => setEnlarged(true)}
          className="h-12 w-12 cursor-zoom-in rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md bg-surface-alt text-[9px] text-ink-muted">
          No QR
        </div>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{staff.name}</span>
      <input
        type="number"
        step="0.1"
        min={0}
        defaultValue={staff.hourly_rate ?? ""}
        placeholder="Rate RM/hr"
        disabled={ratePending}
        onBlur={handleRateBlur}
        title="Default hourly rate"
        className="w-24 flex-none rounded-md border border-border bg-bg px-2 py-1 text-right text-xs"
      />
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" id={`staff-qr-${staff.id}`} />
      <label
        htmlFor={`staff-qr-${staff.id}`}
        className="cursor-pointer rounded-md bg-surface-alt px-2.5 py-1 text-xs font-bold text-ink-muted"
      >
        {pending ? "Uploading…" : staff.qr_url ? "Replace QR" : "Upload QR"}
      </label>
      <button
        onClick={() => (confirmDelete ? startTransition(() => deleteStaff(staff.id)) : onAskDelete())}
        onBlur={onCancelDelete}
        className={`rounded-md px-2 py-1 text-xs font-bold ${
          confirmDelete ? "bg-danger text-white" : "bg-surface-alt text-danger"
        }`}
      >
        {confirmDelete ? "✔" : "✕"}
      </button>
      {error && <p className="basis-full text-xs font-semibold text-danger">{error}</p>}
      {enlarged && staff.qr_url && (
        <QrModal url={staff.qr_url} label={`${staff.name} QR pay code`} onClose={() => setEnlarged(false)} />
      )}
    </div>
  );
}

function PayoutRow({ payout, staffName }: { payout: StaffPayout; staffName: string | null }) {
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateLabel = new Date(payout.created_at).toLocaleString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{staffName ?? "No staff selected"}</span>
          {payout.hours != null && (
            <span className="flex-none rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent">
              ⏱️ {payout.hours} hr{Number(payout.hours) === 1 ? "" : "s"} × {fmt(Number(payout.hourly_rate ?? 0))}/hr
            </span>
          )}
        </div>
        <div className="text-xs text-ink-muted">
          {dateLabel}
          {payout.note ? ` · ${payout.note}` : ""}
        </div>
      </div>
      <span className="font-extrabold text-ink">{fmt(Number(payout.amount))}</span>
      <button
        disabled={pending}
        onClick={() => startTransition(() => markStaffPayoutPaid(payout.id, !payout.paid))}
        className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
          payout.paid ? "border border-border text-ink-muted" : "bg-success text-white"
        }`}
      >
        {payout.paid ? "Paid" : "Mark as paid"}
      </button>
      <button
        disabled={pending}
        onClick={() =>
          confirmDelete
            ? startTransition(async () => {
                await deleteStaffPayout(payout.id);
                setConfirmDelete(false);
              })
            : setConfirmDelete(true)
        }
        className={`rounded-md px-2 py-1 text-xs font-bold ${
          confirmDelete ? "bg-danger text-white" : "bg-surface-alt text-danger"
        }`}
      >
        {confirmDelete ? "✔" : "✕"}
      </button>
    </div>
  );
}
