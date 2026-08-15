import Link from "next/link";
import { logIn } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <>
      <h1 className="mb-1 text-lg font-bold text-ink">Log in</h1>
      <p className="mb-6 text-sm text-ink-muted">Welcome back.</p>

      {notice && (
        <div className="mb-4 rounded-lg bg-surface-alt px-3 py-2 text-sm text-gold">{notice}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <form action={logIn} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-strong"
        >
          Log in
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-accent">
          Create a cafe account
        </Link>
      </p>
    </>
  );
}
