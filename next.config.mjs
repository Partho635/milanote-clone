/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH || "";

const nextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  ...(isStatic
    ? {
        // GitHub Pages build: plain HTML/JS, data stored in the browser
        output: "export",
        basePath,
        assetPrefix: basePath || undefined,
        trailingSlash: true,
        images: { unoptimized: true },
        env: { NEXT_PUBLIC_STATIC: "1" },
      }
    : {}),
};
export default nextConfig;
