import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB. Raised to fit the 5MB avatar upload limit plus
      // multipart/form-data overhead (boundaries, part headers).
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
