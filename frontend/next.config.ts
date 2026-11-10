import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Cloud Run 컨테이너 배포용
  devIndicators: { position: "bottom-right" }, // 좌측 메뉴 하단을 가리지 않도록
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
