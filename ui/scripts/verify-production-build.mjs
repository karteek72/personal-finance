#!/usr/bin/env node
/**
 * Fail production builds when mock mode is enabled at build time.
 * NEXT_PUBLIC_* is inlined at build — runtime env cannot disable mocks.
 */
const isProd =
  process.env.NODE_ENV === "production" ||
  process.argv.includes("--production");

if (isProd && process.env.NEXT_PUBLIC_USE_MOCKS === "true") {
  console.error(
    "\n[spendflow-ui] FATAL: NEXT_PUBLIC_USE_MOCKS=true is not allowed for production builds.\n" +
      "Unset it or set NEXT_PUBLIC_USE_MOCKS=false when running `npm run build`.\n" +
      "See ui/README.md — Mock data mode.\n",
  );
  process.exit(1);
}

if (isProd) {
  console.log(
    "[spendflow-ui] Production build: mocks disabled (NEXT_PUBLIC_USE_MOCKS !== true)",
  );
}
