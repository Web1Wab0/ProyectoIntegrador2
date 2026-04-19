import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "hoyukdmwiwkexparwkog.supabase.co",
      },
    ],
  },
};

export default nextConfig;