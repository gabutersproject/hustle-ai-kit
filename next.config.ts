import type { NextConfig } from "next";

const exporting = process.env.SAWHORSE_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(exporting ? { output: "export" as const } : {}),
};

export default nextConfig;
