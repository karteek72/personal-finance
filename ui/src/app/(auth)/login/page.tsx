import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-surface p-8 card-shadow">
        <p className="text-2xl font-extrabold tracking-tight text-gradient">
          SpendFlow
        </p>
        <h1 className="mt-4 text-xl font-bold text-text">Welcome back</h1>
        <p className="mt-1 text-sm text-text-muted">
          Sign in to pick up where you left off
        </p>

        <form className="mt-6 flex flex-col gap-4" action="#" method="post">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-text-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="rounded-[var(--radius-sm)] border-0 bg-bg px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-xs font-semibold text-text-muted"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-[var(--radius-sm)] border-0 bg-bg px-4 py-3 text-sm text-text outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-[var(--radius-pill)] bg-primary px-4 py-3 text-sm font-semibold text-text-inverse transition-opacity hover:opacity-90"
          >
            Sign in
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-text-muted">
          New here?{" "}
          <Link href="/register" className="font-semibold text-primary">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
