import type { HappyHourSettings } from "@/lib/types";

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";
  if (isNaN(hours)) return timeStr;

  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function calculateHappyHourItemPrice(
  originalPrice: number,
  settings: HappyHourSettings | null | undefined
): number {
  if (!settings) return originalPrice;

  if (settings.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(settings.discount_percent ?? 0)));
    if (pct <= 0) return originalPrice;
    const discounted = originalPrice * (1 - pct / 100);
    return Math.max(0, Math.round(discounted * 100) / 100);
  }

  // "flat" price mode
  return Number(settings.price ?? 0);
}

export function getHappyHourDiscountLabel(
  settings: HappyHourSettings | null | undefined
): string {
  if (!settings) return "";
  if (settings.discount_type === "percent") {
    return `${Number(settings.discount_percent ?? 0)}% OFF`;
  }
  return `Flat RM ${Number(settings.price ?? 0).toFixed(2)}`;
}

export function isHappyHourActive(
  settings: HappyHourSettings | null | undefined,
  now: Date = new Date()
): boolean {
  if (!settings || !settings.is_enabled) return false;
  if (settings.force_active) return true;

  const todayStr = getLocalDateString(now);

  // If a target date is specified, it must match today's date
  if (settings.target_date && settings.target_date !== todayStr) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = (settings.start_time || "17:00").split(":").map(Number);
  const [endH, endM] = (settings.end_time || "19:00").split(":").map(Number);

  const startMinutes = (startH || 0) * 60 + (startM || 0);
  const endMinutes = (endH || 0) * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    // Standard same-day window (e.g. 17:00 to 19:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight window (e.g. 22:00 to 02:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

export function getHappyHourStatus(
  settings: HappyHourSettings | null | undefined,
  now: Date = new Date()
): {
  isActive: boolean;
  type: "active" | "forced" | "scheduled" | "expired" | "disabled";
  label: string;
  subLabel: string;
  discountText: string;
} {
  const discountLabel = getHappyHourDiscountLabel(settings);

  if (!settings || !settings.is_enabled) {
    return {
      isActive: false,
      type: "disabled",
      label: "Disabled",
      subLabel: "Happy hour is turned off.",
      discountText: discountLabel || "Not configured",
    };
  }

  if (settings.force_active) {
    return {
      isActive: true,
      type: "forced",
      label: "Flash Sale Active",
      subLabel: `Manually activated — ${
        settings.discount_type === "percent"
          ? `all items are ${Number(settings.discount_percent ?? 0)}% off.`
          : `all items sell for RM ${Number(settings.price ?? 0).toFixed(2)}.`
      }`,
      discountText: discountLabel,
    };
  }

  const todayStr = getLocalDateString(now);
  const isExpired = settings.target_date != null && settings.target_date !== todayStr;

  if (isExpired) {
    return {
      isActive: false,
      type: "expired",
      label: "Past Date",
      subLabel: `Promotion was set for ${settings.target_date}. Set a new time for today to activate.`,
      discountText: discountLabel,
    };
  }

  const active = isHappyHourActive(settings, now);
  if (active) {
    return {
      isActive: true,
      type: "active",
      label: "Active Now",
      subLabel: `Running until ${formatTime12h(settings.end_time)} — ${
        settings.discount_type === "percent"
          ? `all items are ${Number(settings.discount_percent ?? 0)}% off.`
          : `all items are RM ${Number(settings.price ?? 0).toFixed(2)}.`
      }`,
      discountText: discountLabel,
    };
  }

  return {
    isActive: false,
    type: "scheduled",
    label: "Scheduled for Today",
    subLabel: `Scheduled today from ${formatTime12h(settings.start_time)} to ${formatTime12h(
      settings.end_time
    )} (${discountLabel}).`,
    discountText: discountLabel,
  };
}
