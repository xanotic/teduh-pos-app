"use client";

import { useState, useTransition, useMemo } from "react";
import type { HappyHourDiscountType, HappyHourSettings, MenuItem } from "@/lib/types";
import { fmt } from "@/lib/format";
import {
  calculateHappyHourItemPrice,
} from "@/lib/happyHour";
import { startHappyHour, stopHappyHour, saveHappyHourSettings } from "./actions";

const PRESET_FLAT_PRICES = [3, 4, 5, 6, 7, 8, 10];
const PRESET_PERCENTAGES = [10, 15, 20, 25, 30, 50];
const DURATION_OPTIONS = [
  { hours: null, label: "Until I Stop It", icon: "♾️" },
  { hours: 1, label: "1 Hour", icon: "⏱️" },
  { hours: 2, label: "2 Hours", icon: "⏱️" },
  { hours: 3, label: "3 Hours", icon: "⏱️" },
];

export function HappyHourClient({
  initialSettings,
  menuItems,
}: {
  initialSettings: HappyHourSettings | null;
  menuItems: MenuItem[];
}) {
  const [pending, startTransition] = useTransition();

  const isCurrentlyActive = Boolean(initialSettings?.force_active || initialSettings?.is_enabled);

  // Active settings currently running on the POS / Supabase
  const activeDiscountType: HappyHourDiscountType = initialSettings?.discount_type ?? "percent";
  const activePrice = initialSettings?.price != null ? Number(initialSettings.price) : 5.0;
  const activeDiscountPercent =
    initialSettings?.discount_percent != null ? Number(initialSettings.discount_percent) : 20;

  // Local draft inputs in the form
  const [discountType, setDiscountType] = useState<HappyHourDiscountType>(activeDiscountType);
  const [price, setPrice] = useState(
    initialSettings?.price != null ? String(initialSettings.price) : "5.00"
  );
  const [discountPercent, setDiscountPercent] = useState(
    initialSettings?.discount_percent != null
      ? String(initialSettings.discount_percent)
      : "20"
  );
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const numericPrice = parseFloat(price) || 0;
  const numericPercent = parseFloat(discountPercent) || 0;

  const hasUnsavedChanges =
    isCurrentlyActive &&
    (discountType !== activeDiscountType ||
      (discountType === "percent" && numericPercent !== activeDiscountPercent) ||
      (discountType === "flat" && numericPrice !== activePrice));

  // Preview settings for the draft table below
  const currentPreviewSettings: HappyHourSettings = useMemo(
    () => ({
      id: initialSettings?.id ?? "preview",
      business_id: initialSettings?.business_id ?? "",
      is_enabled: isCurrentlyActive,
      discount_type: discountType,
      price: numericPrice,
      discount_percent: numericPercent,
      start_time: initialSettings?.start_time ?? "00:00",
      end_time: initialSettings?.end_time ?? "23:59",
      target_date: null,
      force_active: isCurrentlyActive,
      updated_at: new Date().toISOString(),
    }),
    [initialSettings, isCurrentlyActive, discountType, numericPrice, numericPercent]
  );

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleStartSession() {
    if (discountType === "percent" && (numericPercent <= 0 || numericPercent > 100)) {
      showToast("Please enter a valid discount percentage (1–100%)");
      return;
    }
    if (discountType === "flat" && (numericPrice < 0 || isNaN(numericPrice))) {
      showToast("Please enter a valid flat price");
      return;
    }

    startTransition(async () => {
      try {
        await startHappyHour({
          discountType,
          price: numericPrice,
          discountPercent: numericPercent,
          durationHours: selectedDuration,
        });
        showToast(
          `Happy Hour started! (${
            discountType === "percent" ? `${numericPercent}% OFF` : fmt(numericPrice)
          })`
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to start Happy Hour.");
      }
    });
  }

  function handleStopSession() {
    startTransition(async () => {
      try {
        await stopHappyHour();
        showToast("Happy Hour ended. Catalog prices restored.");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to stop Happy Hour.");
      }
    });
  }

  function handleUpdateLiveSession() {
    if (discountType === "percent" && (numericPercent <= 0 || numericPercent > 100)) {
      showToast("Please enter a valid discount percentage (1–100%)");
      return;
    }
    if (discountType === "flat" && (numericPrice < 0 || isNaN(numericPrice))) {
      showToast("Please enter a valid flat price");
      return;
    }

    startTransition(async () => {
      try {
        await saveHappyHourSettings({
          isEnabled: true,
          forceActive: true,
          discountType,
          price: numericPrice,
          discountPercent: numericPercent,
          startTime: initialSettings?.start_time,
          endTime: initialSettings?.end_time,
        });
        showToast(
          `Updated live promo to ${
            discountType === "percent" ? `${numericPercent}% OFF` : fmt(numericPrice)
          }!`
        );
      } catch (err) {
        showToast(err instanceof Error ? err.message : "Failed to update settings.");
      }
    });
  }

  function handleResetDraft() {
    setDiscountType(activeDiscountType);
    setPrice(String(activePrice));
    setDiscountPercent(String(activeDiscountPercent));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-ink">Happy Hour & Promotions</h1>
        <p className="text-sm text-ink-muted">
          Run instant promotional pricing sessions for your POS catalog with one click.
        </p>
      </div>

      {/* Hero Live Status Card (Shows strictly the CURRENT LIVE ACTIVE price from POS) */}
      <div
        className={`rounded-2xl border p-5 shadow-sm transition ${
          isCurrentlyActive
            ? "border-accent bg-accent-soft/40 shadow-accent/10"
            : "border-border bg-surface opacity-90"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span
              className={`flex h-4 w-4 rounded-full ${
                isCurrentlyActive ? "animate-ping bg-success" : "bg-ink-muted/40"
              }`}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-ink">
                  {isCurrentlyActive ? "Happy Hour is LIVE" : "Happy Hour is Inactive"}
                </span>
                {isCurrentlyActive && (
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                    LIVE ON POS
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {isCurrentlyActive
                  ? `All catalog items sell for ${
                      activeDiscountType === "percent"
                        ? `${activeDiscountPercent}% OFF standard price`
                        : `${fmt(activePrice)} flat`
                    }.`
                  : "Standard catalog prices are active on the register."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                {isCurrentlyActive
                  ? activeDiscountType === "percent"
                    ? "Active Discount"
                    : "Flat Price"
                  : "Status"}
              </div>
              <div className="text-xl font-extrabold text-accent">
                {isCurrentlyActive
                  ? activeDiscountType === "percent"
                    ? `${activeDiscountPercent}% OFF`
                    : fmt(activePrice)
                  : "OFF"}
              </div>
            </div>
            {isCurrentlyActive && (
              <button
                type="button"
                onClick={handleStopSession}
                disabled={pending}
                className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-xs font-bold text-danger transition hover:bg-danger hover:text-white shadow-sm"
              >
                🛑 Stop Happy Hour
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session Configuration Card */}
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col gap-6">
        {/* Unsaved Changes Banner */}
        {hasUnsavedChanges && (
          <div className="flex items-center justify-between rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs text-ink">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>
                You have changed draft settings. POS is currently using{" "}
                <strong className="text-accent font-bold">
                  {activeDiscountType === "percent"
                    ? `${activeDiscountPercent}% OFF`
                    : fmt(activePrice)}
                </strong>
                . Click <strong>Update Live Price Settings</strong> below to apply.
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetDraft}
              className="text-xs font-bold text-accent underline hover:opacity-80 ml-2"
            >
              Reset
            </button>
          </div>
        )}

        <div>
          <h2 className="text-sm font-bold text-ink mb-1">1. Choose Discount Mode</h2>
          <p className="text-xs text-ink-muted mb-3">
            Select how you want the discount applied across your menu.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDiscountType("percent")}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                discountType === "percent"
                  ? "border-accent bg-accent-soft text-accent shadow-sm"
                  : "border-border bg-surface-alt text-ink-muted hover:text-ink"
              }`}
            >
              <span className="text-2xl">🏷️</span>
              <div>
                <div className="text-sm font-bold text-ink">Percentage Discount</div>
                <div className="text-xs text-ink-muted">e.g. 20% off all catalog items</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDiscountType("flat")}
              className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                discountType === "flat"
                  ? "border-accent bg-accent-soft text-accent shadow-sm"
                  : "border-border bg-surface-alt text-ink-muted hover:text-ink"
              }`}
            >
              <span className="text-2xl">💵</span>
              <div>
                <div className="text-sm font-bold text-ink">Flat / Exact Price</div>
                <div className="text-xs text-ink-muted">e.g. RM 5.00 for all items</div>
              </div>
            </button>
          </div>
        </div>

        {/* Step 2: Set Amount */}
        <div>
          <h2 className="text-sm font-bold text-ink mb-1">
            2. {discountType === "percent" ? "Set Discount Percentage" : "Set Flat Price"}
          </h2>
          <p className="text-xs text-ink-muted mb-3">
            {discountType === "percent"
              ? "Every menu item will be discounted by this percentage."
              : "During the session, all catalog items will sell for this exact price."}
          </p>

          {discountType === "percent" ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
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
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
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
          )}
        </div>

        {/* Step 3: Optional Duration */}
        {!isCurrentlyActive && (
          <div>
            <h2 className="text-sm font-bold text-ink mb-1">3. Session Duration (Optional)</h2>
            <p className="text-xs text-ink-muted mb-3">
              Choose how long this session should run, or leave it until you manually stop it.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => {
                const active = selectedDuration === opt.hours;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setSelectedDuration(opt.hours)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition ${
                      active
                        ? "border-accent bg-accent-soft text-accent shadow-sm"
                        : "border-border bg-surface-alt text-ink-muted hover:text-ink"
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Catalog Price Preview */}
        {menuItems.length > 0 && (
          <div className="rounded-xl border border-border bg-bg p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                {isCurrentlyActive ? "Preview of Draft Settings" : "Price Preview"} ({menuItems.length} items)
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
                    className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-xs"
                  >
                    <span className="truncate font-semibold text-ink">{m.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-muted line-through">{fmt(m.price)}</span>
                      <span className="font-bold text-accent">{fmt(discountedPrice)}</span>
                      {pct > 0 && (
                        <span className="rounded bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {!isCurrentlyActive ? (
            <button
              type="button"
              onClick={handleStartSession}
              disabled={pending}
              className="flex-1 rounded-xl bg-accent py-3.5 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-50 shadow-sm flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>{pending ? "Starting..." : "Start Happy Hour Now"}</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleUpdateLiveSession}
                disabled={pending}
                className="flex-1 rounded-xl bg-accent py-3.5 text-sm font-bold text-white transition hover:bg-accent-strong disabled:opacity-50 shadow-sm"
              >
                {pending ? "Updating..." : "🔄 Update Live Price Settings"}
              </button>
              <button
                type="button"
                onClick={handleStopSession}
                disabled={pending}
                className="rounded-xl border border-danger/40 bg-danger/10 px-6 py-3.5 text-sm font-bold text-danger transition hover:bg-danger hover:text-white disabled:opacity-50 shadow-sm"
              >
                🛑 Stop Happy Hour
              </button>
            </>
          )}
        </div>

        {toast && (
          <div className="rounded-lg bg-ink px-3 py-2 text-center text-xs font-semibold text-white">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
