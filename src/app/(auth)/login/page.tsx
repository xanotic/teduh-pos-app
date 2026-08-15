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
      <h1 className="mb-1 text-lg font-bold text-stone-900">Log in</h1>
      <p className="mb-6 text-sm text-stone-500">Welcome back.</p>

      {notice && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <form action={logIn} className="flex flex-col gap-4">
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
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-rose-800 focus:ring-1 focus:ring-rose-800"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-lg bg-rose-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-800"
        >
          Log in
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-stone-500">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-rose-900">
          Create a cafe account
        </Link>
      </p>
    </>
  );
}
