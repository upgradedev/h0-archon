import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

// ---------------------------------------------------------------------------
// Conditional GitHub OAuth gating.
//
// Auth is OPT-IN. The app gates ONLY when both GitHub OAuth credentials are
// present. With no env set (the CI / preview / public-judge path) AUTH_ENABLED
// is false, no provider is registered, and the middleware lets everything
// through — the app stays fully open and the build stays green.
// ---------------------------------------------------------------------------

const githubId = process.env.AUTH_GITHUB_ID;
const githubSecret = process.env.AUTH_GITHUB_SECRET;

export const AUTH_ENABLED = Boolean(githubId && githubSecret);

// NextAuth needs a secret to sign/verify JWTs. In production it is REQUIRED and
// missing it throws (MissingSecret). To keep the no-env build/preview from
// crashing, fall back to a clearly-non-secret placeholder for build only. This
// value never protects real sessions: it is only reachable when AUTH_ENABLED is
// false (no provider, nothing to sign in to).
const authSecret =
  process.env.AUTH_SECRET ?? "build-only-not-a-secret-set-AUTH_SECRET-in-prod";

if (!process.env.AUTH_SECRET) {
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] AUTH_SECRET is not set; using a build-only placeholder. " +
      "Set AUTH_SECRET in the deployment environment for real sessions.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Behind Vercel's proxy / Firebase BFF the Host header is trusted.
  trustHost: true,
  secret: authSecret,
  // Stateless JWT sessions — no DB adapter, so the whole config is Edge-safe
  // and can run unchanged in the middleware.
  session: { strategy: "jwt" },
  providers: AUTH_ENABLED
    ? [
        GitHub({
          clientId: githubId,
          clientSecret: githubSecret,
        }),
      ]
    : [],
});
