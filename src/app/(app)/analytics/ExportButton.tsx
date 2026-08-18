"use client";

import { useState } from "react";
import type { FoodFinancialStats, AnalyticsStats } from "@/lib/analytics";
import type { Transaction } from "@/lib/types";

export function ExportButton({
  transactions,
  stats,
  foodFinancials,
  rangeLabel,
}: {
  transactions: Transaction[];
  stats: AnalyticsStats;
  foodFinancials: FoodFinancialStats;
  rangeLabel: string;
}) {
  const [downloading, setDownloading] = useState(false);

  function escapeCSV(val: string | number | null | undefined): string {
    if (val == null) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function handleExport() {
    setDownloading(true);

    try {
      const nowStr = new Date().toLocaleString("en-MY", {
        timeZone: "Asia/Kuala_Lumpur",
        dateStyle: "medium",
        timeStyle: "short",
      });

      const lines: string[] = [];

      // UTF-8 BOM so Excel opens it with proper character encoding
      lines.push(
        "TEDUH POS - SALES & FINANCIAL ANALYTICS REPORT",
        `Date Range / Filter,${escapeCSV(rangeLabel)}`,
        `Exported At,${escapeCSV(nowStr)}`,
        ""
      );

      // Section 1: Financial & Business KPI Summary
      lines.push(
        "--- EXECUTIVE SUMMARY ---",
        `Total Revenue (RM),${stats.revenue.toFixed(2)}`,
        `Total Food Cost Sold / COGS (RM),${stats.cost.toFixed(2)}`,
        `Estimated Profit (RM),${stats.profit.toFixed(2)}`,
        `Upfront Food Paid (RM),${foodFinancials.upfrontPaidTotal.toFixed(2)}`,
        `Remaining to Break Even (RM),${foodFinancials.breakEvenNeeded.toFixed(2)}`,
        `Break-Even Status,${
          foodFinancials.breakEvenAchieved
            ? `Achieved (+RM ${foodFinancials.netSurplus.toFixed(2)} surplus)`
            : `${foodFinancials.breakEvenPercent}% Recovered`
        }`,
        `Total Orders,${stats.orders}`,
        `Total Items Sold,${stats.itemsSold}`,
        `Average Order Value (RM),${stats.avgOrder.toFixed(2)}`,
        `Giveaways Cost (RM),${stats.giveawayCost.toFixed(2)}`,
        ""
      );

      // Section 2: Payment Method Breakdown
      lines.push(
        "--- PAYMENT METHOD SPLIT ---",
        "Payment Method,Transaction Count,Total Revenue (RM)"
      );
      stats.byPayment.forEach((p) => {
        lines.push(`${escapeCSV(p.name)},${p.count},${p.revenue.toFixed(2)}`);
      });
      lines.push("");

      // Section 3: Item Performance Summary
      lines.push(
        "--- ITEM SALES SUMMARY ---",
        "Item Name,Category,Quantity Sold,Total Revenue (RM),Total Cost (RM),Profit (RM)"
      );
      stats.byItem.forEach((it) => {
        // Find category and cost for this item
        let itemCostTotal = 0;
        let itemCategory = "";

        transactions.forEach((t) => {
          t.transaction_items?.forEach((li) => {
            if (li.name.trim().toLowerCase() === it.name.trim().toLowerCase()) {
              if (li.category) itemCategory = li.category;
              if (typeof li.cost === "number") {
                itemCostTotal += li.cost * li.qty;
              }
            }
          });
        });

        const itemProfit = it.revenue - itemCostTotal;
        lines.push(
          `${escapeCSV(it.name)},${escapeCSV(itemCategory || "Other")},${it.qty},${it.revenue.toFixed(
            2
          )},${itemCostTotal.toFixed(2)},${itemProfit.toFixed(2)}`
        );
      });
      lines.push("");

      // Section 4: Detailed Transaction Lines
      lines.push(
        "--- DETAILED TRANSACTION LOG ---",
        "Date,Time,Transaction ID,Payment Method,Item Name,Category,Quantity,Unit Price (RM),Unit Cost (RM),Line Total (RM),Line Cost (RM),Line Profit (RM),Note"
      );

      transactions.forEach((t) => {
        const d = new Date(t.ts);
        const dateStr = d.toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur" });
        const timeStr = d.toLocaleTimeString("en-MY", {
          timeZone: "Asia/Kuala_Lumpur",
          hour: "2-digit",
          minute: "2-digit",
        });

        (t.transaction_items ?? []).forEach((line) => {
          const lineTotal = line.price * line.qty;
          const lineCost = typeof line.cost === "number" ? line.cost * line.qty : 0;
          const lineProfit = lineTotal - lineCost;

          lines.push(
            [
              escapeCSV(dateStr),
              escapeCSV(timeStr),
              escapeCSV(t.id),
              escapeCSV(t.payment_method),
              escapeCSV(line.name),
              escapeCSV(line.category || "Other"),
              line.qty,
              line.price.toFixed(2),
              typeof line.cost === "number" ? line.cost.toFixed(2) : "",
              lineTotal.toFixed(2),
              typeof line.cost === "number" ? lineCost.toFixed(2) : "",
              typeof line.cost === "number" ? lineProfit.toFixed(2) : "",
              escapeCSV(t.note || ""),
            ].join(",")
          );
        });
      });

      const csvContent = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      const sanitizedRange = rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `teduh_analytics_${sanitizedRange}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={downloading}
      className="flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2 text-xs font-bold text-ink transition hover:border-accent hover:text-accent shadow-2xs disabled:opacity-50"
      title="Export summary & detailed transaction data to CSV / Excel"
    >
      <span>{downloading ? "⏳" : "📥"}</span>
      <span>{downloading ? "Exporting..." : "Export Excel"}</span>
    </button>
  );
}
