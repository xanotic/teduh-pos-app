import Link from "next/link";
import { signUp } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <h1 className="mb-1 text-lg font-bold text-ink">Create your cafe&apos;s account</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Free, no billing. You get your own private workspace &mdash; nothing here is shared with other businesses.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <form action={signUp} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Business name
          </label>
          <input
            name="businessName"
            required
            placeholder="e.g. Teduh Dessert"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
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
            minLength={6}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold text-white hover:bg-accent-strong"
        >
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-accent">
          Log in
        </Link>
      </p>
    </>
  );
}
