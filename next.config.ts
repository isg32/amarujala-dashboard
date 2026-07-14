import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Unset on Vercel (app owns the whole domain). Set to "/dashboard" only
  // for the self-hosted nginx deployment, which mounts this app under
  // /dashboard alongside an unrelated static site at the domain root — see
  // CLAUDE.md's deployment notes. Baked in at build time; changing it needs
  // a rebuild, not just a restart.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // Prevents Next.js from redirecting between /dashboard and /dashboard/
  // endlessly when the internal path is / — harmless on Vercel, required
  // under nginx + basePath where the root URL triggers the redirect loop.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
