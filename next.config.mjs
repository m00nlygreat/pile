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
};

export default nextConfig;
