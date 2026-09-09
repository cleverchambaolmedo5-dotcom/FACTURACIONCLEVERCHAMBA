/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-hosted on Hostinger (single Node process via Passenger). Without a
  // deploymentId, a browser tab left open across a deploy can keep
  // client-side navigating with the previous build's asset/action IDs once
  // the server has switched to the new build, producing exactly this kind
  // of "unstyled/broken" page. Setting it makes Next.js detect that
  // mismatch and force a full reload instead. See Next's self-hosting docs
  // ("Version Skew") -- this is a Next.js 16 config, not present in older
  // versions. Falls back to the build timestamp so it's unique per deploy
  // with zero extra Hostinger configuration required.
  deploymentId: process.env.NEXT_DEPLOYMENT_ID ?? String(Date.now()),
  experimental: {
    serverActions: {
      // Default is 1MB. Raised to fit the 5MB avatar upload limit plus
      // multipart/form-data overhead (boundaries, part headers).
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
