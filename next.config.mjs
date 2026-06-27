/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pg` is a native-ish dependency; keep it external to the server bundle.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
