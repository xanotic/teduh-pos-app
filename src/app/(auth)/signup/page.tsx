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
      <h1 className="mb-1 text-lg font-bold text-stone-900">Create your cafe&apos;s account</h1>
      <p className="mb-6 text-sm text-stone-500">
        Free, no billing. You get your own private workspace &mdash; nothing here is shared with other businesses.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <form action={signUp} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
            Business name
          </label>
          <input
            name="businessName"
            required
            placeholder="e.g. Teduh Dessert"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-rose-800 focus:ring-1 focus:ring-rose-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
            Email
          </label>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-rose-800 focus:ring-1 focus:ring-rose-800"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-500">
            Password
          </label>
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-rose-800 focus:ring-1 focus:ring-rose-800"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-rose-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800"
        >
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-rose-900">
          Log in
        </Link>
      </p>
    </>
  );
}
