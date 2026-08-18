"use client";

import { useState, useTransition, useMemo } from "react";
import type { HappyHourDiscountType, HappyHourSettings, MenuItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import {
  calculateHappyHourItemPrice,
  formatTime12h,
  getHappyHourStatus,
  getLocalDateString,
} from "@/lib/happyHour";
import { saveHappyHourSettings, toggleForceActive } from "./actions";

const PRESET_FLAT_PRICES = [3, 4, 5, 6, 7, 8, 10];
const PRESET_PERCENTAGES = [10, 15, 20, 25, 30, 50];

export function HappyHourClient({
  initialSettings,
  menuItems,
}: {
  initialSettings: HappyHourSettings | null;
  menuItems: MenuItem[];
}) {
  const [pending, startTransition] = useTransition();

  const todayStr = useMemo(() => getLocalDateString(new Date()), []);
  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString("en-MY", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    []
  );

  const [isEnabled, setIsEnabled] = useState(initialSettings?.is_enabled ?? false);
  const [discountType, setDiscountType] = useState<HappyHourDiscountType>(
    initialSettings?.discount_type ?? "percent"
  );
  const [price, setPrice] = useState(
    initialSettings?.price != null ? String(initialSettings.price) : "5.00"
  );
  const [discountPercent, setDiscountPercent] = useState(
    initialSettings?.discount_percent != null
      ? String(initialSettings.discount_percent)
      : "20"
  );
  const [startTime, setStartTime] = useState(initialSettings?.start_time ?? "17:00");
  const [endTime, setEndTime] = useState(initialSettings?.end_time ?? "19:00");
  const [targetDate, setTargetDate] = useState<string>(
    initialSettings?.target_date ?? todayStr
  );
  const [forceActive, setForceActive] = useState(initialSettings?.force_active ?? false);
  const [toast, setToast] = useState<string | null>(null);

  const numericPrice = parseFloat(price) || 0;
  const numericPercent = parseFloat(discountPercent) || 0;

  const currentPreviewSettings: HappyHourSettings = useMemo(
    () => ({
      id: initialSettings?.id ?? "preview",
      business_id: initialSettings?.business_id ?? "",
      is_enabled: isEnabled,
      discount_type: discountType,
      price: numericPrice,
      discount_percent: numericPercent,
      start_time: startTime,
      end_time: endTime,
      target_date: targetDate,
      force_active: forceActive,
      updated_at: new Date().toISOString(),
    }),
    [
      initialSettings,
      isEnabled,
      discountType,
      numericPrice,
      numericPercent,
      startTime,
      endTime,
      targetDate,
      forceActive,
    ]
  );

  const status = getHappyHourStatus(currentPreviewSettings);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function applyPresetDuration(hours: number) {
    const now = new Date();
    const startH = String(now.getHours()).padStart(2, "0");
    const startM = String(now.getMinutes()).padStart(2, "0");
    const end = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const endH = String(end.getHours()).padStart(2, "0");
    const endM = String(end.getMinutes()).padStart(2, "0");

    setStartTime(`${startH}:${startM}`);
    setEndTime(`${endH}:${endM}`);
    setTargetDate(todayStr);
    setIsEnabled(true);
    showToast(`Set for the next ${hours} hour${hours > 1 ? "s" : ""} today`);
  }

  function applyFixedSlot(start: string, end: string, label: string) {
    setStartTime(start);
    setEndTime(end);
    setTargetDate(todayStr);
    setIsEnabled(true);
    showToast(`Time slot set to ${label}`);
  }

  function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    startTransition(async () => {
      try {
        await saveHappyHourSettings({
          isEnabled,
          discountType,
          price: numericPrice,
          discountPercent: numericPercent,
          startTime,
          endTime,
          targetDate: todayStr, // Always sets for today
          forceActive,
        });
        setTargetDate(todayStr);
        showToast("Happy hour settings saved for today!");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to save settings.");
      }
    });
  }

  function handleToggleForce() {
    const nextForced = !forceActive;
    setForceActive(nextForced);
    if (nextForced) setIsEnabled(true);
    startTransition(async () => {
      try {
        await toggleForceActive(nextForced);
        showToast(nextForced ? "Flash sale activated now!" : "Flash sale ended.");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to toggle flash sale.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">Happy Hour & Promotions</h1>
          <p className="text-sm text-ink-muted">
            Set a one-time promo schedule for today or trigger an instant flash sale.
          </p>
        </div>
        <button
          onClick={handleToggleForce}
          disabled={pending}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition shadow-sm ${
            forceActive
              ? "bg-danger text-white hover:bg-danger/90"
              : "border border-gold bg-surface-alt text-gold hover:bg-gold hover:text-black"
          }`}
        >
          <span>{forceActive ? "⏹ Stop Flash Sale" : "⚡ Force Active Now"}</span>
        </button>
      </div>

      {/* Live Status Card */}
      <div
        className={`mb-6 rounded-2xl border p-4 shadow-sm transition ${
          status.type === "forced"
            ? "border-gold bg-gold/10"
            : status.type === "active"
              ? "border-success bg-success-soft"
              : status.type === "scheduled"
                ? "border-border bg-surface"
                : "border-border bg-surface opacity-80"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-3 w-3 rounded-full ${
                status.isActive ? "animate-ping bg-success" : "bg-ink-muted"
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink">{status.label}</span>
                {status.isActive && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-white">
                    LIVE ON POS
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted">{status.subLabel}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">
              {discountType === "percent" ? "Discount" : "Flat Price"}
            </div>
            <div className="text-xl font-extrabold text-accent">
              {discountType === "percent" ? `${numericPercent}% OFF` : fmt(numericPrice)}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col gap-6"
      >
        {/* Enable / Disable Switch */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="text-sm font-bold text-ink">Enable Promotion</div>
            <p className="text-xs text-ink-muted">
              Activate automatic pricing for the Sell register during today&apos;s scheduled time.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-surface-alt after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-ink-muted after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-checked:after:bg-white" />
          </label>
        </div>

        {/* Discount Type Selector */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Discount Option
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDiscountType("percent")}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                discountType === "percent"
                  ? "border-accent bg-accent-soft text-accent shadow-sm"
                  : "border-border bg-surface-alt text-ink-muted hover:text-ink"
              }`}
            >
              <span className="text-lg">🏷️</span>
              <span className="text-xs font-bold">Percentage Discount</span>
              <span className="text-[11px] opacity-80">e.g. 20% off all catalog items</span>
            </button>

            <button
              type="button"
              onClick={() => setDiscountType("flat")}
              className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition ${
                discountType === "flat"
                  ? "border-accent bg-accent-soft text-accent shadow-sm"
                  : "border-border bg-surface-alt text-ink-muted hover:text-ink"
              }`}
            >
              <span className="text-lg">💵</span>
              <span className="text-xs font-bold">Exact / Flat Price</span>
              <span className="text-[11px] opacity-80">e.g. RM 5.00 for all items</span>
            </button>
          </div>
        </div>

        {/* Discount Amount Configuration */}
        {discountType === "percent" ? (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Discount Percentage (%)
            </label>
            <p className="mb-2 text-xs text-ink-muted">
              Each menu item will be discounted by this percentage from its normal price.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative max-w-xs flex-1">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  required
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="20"
                  className="input pr-10 text-base font-bold"
                />
                <span className="absolute right-3 top-2.5 text-sm font-bold text-ink-muted">
                  %
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_PERCENTAGES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setDiscountPercent(String(p))}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                      numericPercent === p
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-surface-alt text-ink-muted hover:text-ink"
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Flat Price per Item (RM)
            </label>
            <p className="mb-2 text-xs text-ink-muted">
              During happy hour, all items in the catalog will be sold for this exact price.
            </p>
            <div className="flex items-center gap-3">
              <div className="relative max-w-xs flex-1">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-ink-muted">
                  RM
                </span>
                <input
                  type="number"
                  step="0.10"
                  min="0"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="5.00"
                  className="input pl-10 text-base font-bold"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_FLAT_PRICES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrice(p.toFixed(2))}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                      numericPrice === p
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-surface-alt text-ink-muted hover:text-ink"
                    }`}
                  >
                    RM {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Today Only Time Schedule */}
        <div className="rounded-2xl border border-border bg-surface-alt/40 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-accent">
                  📅 Set Time for Today Only
                </span>
                <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                  {todayFormatted}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">
                One-time schedule for today. It runs only during this window and will not repeat tomorrow.
              </p>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPresetDuration(1)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink transition hover:border-accent hover:text-accent shadow-2xs"
            >
              ⚡ Next 1 Hour
            </button>
            <button
              type="button"
              onClick={() => applyPresetDuration(2)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-bold text-ink transition hover:border-accent hover:text-accent shadow-2xs"
            >
              ⚡ Next 2 Hours
            </button>
            <button
              type="button"
              onClick={() => applyFixedSlot("14:00", "16:00", "Afternoon (2 PM – 4 PM)")}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink shadow-2xs"
            >
              ☀️ Afternoon (2–4 PM)
            </button>
            <button
              type="button"
              onClick={() => applyFixedSlot("17:00", "19:00", "Evening (5 PM – 7 PM)")}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink shadow-2xs"
            >
              🌆 Evening (5–7 PM)
            </button>
            <button
              type="button"
              onClick={() => applyFixedSlot("20:00", "22:00", "Night (8 PM – 10 PM)")}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink shadow-2xs"
            >
              🌙 Night (8–10 PM)
            </button>
          </div>

          {/* Custom Time Window */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input text-sm font-semibold"
              />
              <span className="mt-1 block text-[11px] text-ink-muted">
                {formatTime12h(startTime)}
              </span>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
                End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input text-sm font-semibold"
              />
              <span className="mt-1 block text-[11px] text-ink-muted">
                {formatTime12h(endTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Catalog Price Preview */}
        {menuItems.length > 0 && (
          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                Price Preview ({menuItems.length} items)
              </span>
              <span className="text-xs text-ink-muted font-medium">
                {discountType === "percent" ? (
                  <>
                    Discount: <strong className="text-accent font-bold">-{numericPercent}%</strong>
                  </>
                ) : (
                  <>
                    All sell for:{" "}
                    <strong className="text-accent font-bold">{fmt(numericPrice)}</strong>
                  </>
                )}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1">
              {menuItems.slice(0, 8).map((m) => {
                const discountedPrice = calculateHappyHourItemPrice(
                  m.price,
                  currentPreviewSettings
                );
                const diff = m.price - discountedPrice;
                const pct = m.price > 0 ? Math.round((diff / m.price) * 100) : 0;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-semibold text-ink">{m.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-muted line-through">{fmt(m.price)}</span>
                      <span className="font-bold text-accent">{fmt(discountedPrice)}</span>
                      {pct > 0 && (
                        <span className="rounded bg-success-soft px-1 text-[10px] font-bold text-success">
                          -{pct}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent py-3.5 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-50 shadow-sm"
        >
          {pending ? "Saving..." : "Set & Activate for Today"}
        </button>

        {toast && (
          <div className="rounded-lg bg-ink px-3 py-2 text-center text-xs font-semibold text-white">
            {toast}
          </div>
        )}
      </form>
    </div>
  );
}
