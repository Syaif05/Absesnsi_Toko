import type { NextConfig } from "next";

import { securityHeaders } from "./src/server/security/headers";

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  async headers(){return [{source:"/:path*",headers:securityHeaders(process.env.NODE_ENV==='production')}]},
  distDir: process.env.ISOLATED_PREVIEW === 'true' ? '.next-owner-preview' : '.next',
};

export default nextConfig;
