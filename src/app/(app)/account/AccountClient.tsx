"use client";

import { useState, useTransition } from "react";
import { changeEmail, changePassword, setBossWhatsapp } from "./actions";

export function AccountClient({
  currentEmail,
  businessName,
  bossWhatsapp,
}: {
  currentEmail: string;
  businessName: string;
  bossWhatsapp: string;
}) {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-ink">Account</h1>
      <p className="mb-6 text-sm text-ink-muted">{businessName}</p>

      <BossWhatsappForm current={bossWhatsapp} />
      <EmailForm currentEmail={currentEmail} />
      <PasswordForm />
    </div>
  );
}

function BossWhatsappForm({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold text-ink">Boss&apos;s WhatsApp number</h2>
      <p className="mb-3 text-xs text-ink-muted">
        Used by &quot;Send Daily Report&quot; on the History tab, so it opens straight to them instead of
        asking you to pick a contact each time. Include the country code, digits only — e.g.{" "}
        <span className="font-mono">60123456789</span> (no + or spaces). Leave blank to just pick a
        contact manually each time.
      </p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ""))}
        placeholder="60123456789"
        className="input mb-2"
      />
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            try {
              await setBossWhatsapp(value.trim());
              setMessage("Saved.");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Could not save.");
            }
          })
        }
        className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Save
      </button>
      {message && <p className="mt-2 text-xs font-semibold text-ink-muted">{message}</p>}
    </div>
  );
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mb-6 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold text-ink">Change email</h2>
      <p className="mb-3 text-xs text-ink-muted">Current: {currentEmail}</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="New email address"
        className="input mb-2"
      />
      <button
        disabled={pending || !email.trim()}
        onClick={() =>
          startTransition(async () => {
            try {
              await changeEmail(email.trim());
              setMessage("Check both your old and new inbox — Supabase sends confirmation links to each before the change takes effect.");
              setEmail("");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Could not change email.");
            }
          })
        }
        className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Update email
      </button>
      {message && <p className="mt-2 text-xs font-semibold text-ink-muted">{message}</p>}
    </div>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-bold text-ink">Change password</h2>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password"
        minLength={6}
        className="input mb-2"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm new password"
        minLength={6}
        className="input mb-2"
      />
      <button
        disabled={pending || password.length < 6 || password !== confirm}
        onClick={() =>
          startTransition(async () => {
            try {
              await changePassword(password);
              setMessage("Password updated.");
              setPassword("");
              setConfirm("");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Could not change password.");
            }
          })
        }
        className="rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        Update password
      </button>
      {password && confirm && password !== confirm && (
        <p className="mt-2 text-xs font-semibold text-danger">Passwords don&apos;t match.</p>
      )}
      {message && <p className="mt-2 text-xs font-semibold text-ink-muted">{message}</p>}
    </div>
  );
}
