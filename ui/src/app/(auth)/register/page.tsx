import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold tracking-tight text-text">
          Create account
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Start tracking your spending with SpendFlow
        </p>

        <form className="mt-6 flex flex-col gap-4" action="#" method="post">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-text">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-[var(--radius-card)] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-text"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="rounded-[var(--radius-card)] border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            className="rounded-[var(--radius-card)] bg-primary px-4 py-2 text-sm font-medium text-text-inverse"
          >
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
