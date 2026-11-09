import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  distDir: process.env.ISOLATED_PREVIEW === 'true' ? '.next-owner-preview' : '.next',
};

export default nextConfig;
