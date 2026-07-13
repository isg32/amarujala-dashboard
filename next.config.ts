import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Unset on Vercel (app owns the whole domain). Set to "/dashboard" only
  // for the self-hosted nginx deployment, which mounts this app under
  // /dashboard alongside an unrelated static site at the domain root — see
  // CLAUDE.md's deployment notes. Baked in at build time; changing it needs
  // a rebuild, not just a restart.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};

export default nextConfig;
