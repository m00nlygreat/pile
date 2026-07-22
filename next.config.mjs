/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "goldpod",
    "172.30.1.100",
    "localhost",
    "127.0.0.1",
    "*.local",
  ],
  serverExternalPackages: [],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
