import { handlers } from "@/auth";

// NextAuth OAuth + session endpoints (sign-in, callback, session, csrf, etc.).
// Always mounted; harmless when AUTH_ENABLED is false (no providers registered).
export const { GET, POST } = handlers;
