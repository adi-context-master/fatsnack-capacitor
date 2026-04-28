import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.fatsnag.app",
  appName: "Fat Snag",
  webDir: "www",
  bundledWebRuntime: false,
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
