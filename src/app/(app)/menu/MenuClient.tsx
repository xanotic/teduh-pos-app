"use client";

import { useState, useTransition } from "react";
import type { MenuItem } from "@/lib/types";
import { addMenuItem, deleteMenuItem, updateMenuItem } from "./actions";

export function MenuClient({ items }: { items: MenuItem[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const byCategory = items.reduce<Record<string, MenuItem[]>>((acc, it) => {
    (acc[it.category] ??= []).push(it);
    return acc;
  }, {});

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !category.trim()) return;
    startTransition(async () => {
      await addMenuItem({
        name: name.trim(),
        category: category.trim(),
        price: parseFloat(price) || 0,
        cost: cost === "" ? null : parseFloat(cost) || 0,
      });
      setName("");
      setCategory("");
      setPrice("");
      setCost("");
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-stone-900">Manage Menu</h1>
      <p className="mb-5 text-sm text-stone-500">
        Add items, set prices, or remove things you no longer sell.
      </p>

      <form
        onSubmit={handleAdd}
        className="mb-6 grid grid-cols-2 gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-5 sm:items-end"
      >
        <Field label="Item name" className="col-span-2 sm:col-span-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tiramisu Cake"
            className="input"
          />
        </Field>
        <Field label="Category">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="CAKE"
            className="input"
          />
        </Field>
        <Field label="Price (RM)">
          <input
            type="number"
            step="0.1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Cost (RM)">
          <input
            type="number"
            step="0.1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="input"
          />
        </Field>
        <button
          disabled={pending}
          className="col-span-2 rounded-lg bg-rose-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-50 sm:col-span-5"
        >
          Add item
        </button>
      </form>

      {Object.keys(byCategory)
        .sort()
        .map((cat) => (
          <div key={cat} className="mb-5">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">{cat}</h2>
            <div className="flex flex-col gap-1.5">
              {byCategory[cat].map((it) => (
                <MenuRow
                  key={it.id}
                  item={it}
                  confirming={confirmId === it.id}
                  onDeleteClick={() =>
                    confirmId === it.id
                      ? startTransition(async () => {
                          await deleteMenuItem(it.id);
                          setConfirmId(null);
                        })
                      : setConfirmId(it.id)
                  }
                />
              ))}
            </div>
          </div>
        ))}

      {items.length === 0 && (
        <p className="text-sm text-stone-400">No menu items yet — add your first one above.</p>
      )}
    </div>
  );
}

function MenuRow({
  item,
  confirming,
  onDeleteClick,
}: {
  item: MenuItem;
  confirming: boolean;
  onDeleteClick: () => void;
}) {
  const [, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
      <span className="flex-1 truncate text-sm font-semibold text-stone-800">{item.name}</span>
      <input
        type="number"
        step="0.1"
        defaultValue={item.price || ""}
        placeholder="Price"
        onBlur={(e) => startTransition(() => updateMenuItem(item.id, { price: parseFloat(e.target.value) || 0 }))}
        className="w-20 rounded-md border border-stone-300 px-2 py-1 text-right text-sm"
      />
      <input
        type="number"
        step="0.1"
        defaultValue={item.cost ?? ""}
        placeholder="Cost"
        onBlur={(e) =>
          startTransition(() =>
            updateMenuItem(item.id, { cost: e.target.value === "" ? null : parseFloat(e.target.value) || 0 })
          )
        }
        className="w-20 rounded-md border border-stone-300 px-2 py-1 text-right text-sm"
      />
      <button
        onClick={onDeleteClick}
        className={`rounded-md px-2 py-1 text-xs font-bold ${
          confirming ? "bg-red-600 text-white" : "bg-stone-100 text-red-600"
        }`}
      >
        {confirming ? "✔" : "✕"}
      </button>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-stone-400">
        {label}
      </label>
      {children}
    </div>
  );
}
