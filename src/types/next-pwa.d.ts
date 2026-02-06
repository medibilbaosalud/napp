declare module "next-pwa" {
  import type { NextConfig } from "next";

  type PwaOptions = Record<string, unknown>;
  type WithPwa = (nextConfig: NextConfig) => NextConfig;

  export default function withPWAInit(options: PwaOptions): WithPwa;
}

