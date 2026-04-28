# Fatsnack Capacitor

Native iOS and Android wrapper for the [`fat-snag`](../fat-snag) Next.js app, powered by [Capacitor](https://capacitorjs.com/).

The Next.js source renders each route inside a 402 × 874 "iPhone simulator" frame with a side caption (`01 · iOS splash`, `402 × 874 · iPhone 15 Pro`, etc.). On a real device the bezel, fake Dynamic Island, fake home indicator, and side captions are stripped and the screen content fills the device — see [`web-overrides/`](./web-overrides/).

## Layout

```
Fatsnack Capacitor/
├── capacitor.config.ts        # appId, appName, webDir
├── package.json               # build/sync/run scripts
├── scripts/
│   └── build-web.mjs          # builds fat-snag static export and copies into www/
├── web-overrides/             # injected into every HTML file's <head>
│   ├── capacitor-init.js      # adds `cap-app` class on Capacitor platforms
│   └── capacitor-overrides.css# hides bezel/island/home/caption, fills screen
├── www/                       # built static export — populated by build:web
├── ios/                       # added by `npx cap add ios` (needs CocoaPods)
└── android/                   # added by `npx cap add android`
```

## Prerequisites

- Node 18+ (tested with 24)
- The sibling `fat-snag` repo at `../fat-snag` (or set `FAT_SNAG_DIR` env var)
- **iOS**: Xcode + CocoaPods. Install CocoaPods with:
  ```sh
  brew install cocoapods
  ```
- **Android**: Android Studio with the Android SDK installed. Set `ANDROID_HOME` to point at the SDK (e.g. `~/Library/Android/sdk`). Open the `android/` folder in Android Studio at least once so it can pull Gradle.

## First-time setup

```sh
cd "Fatsnack Capacitor"
npm install
npm run build:web        # builds fat-snag static export → www/
npx cap add ios          # only after CocoaPods is installed
# (Android already added in this repo; rerun `npx cap add android` to recreate.)
npx cap sync
```

## Day-to-day workflow

After any change to the `fat-snag` source:

```sh
npm run build            # build:web + cap sync (pushes www/ to ios/ and android/)
npm run open:ios         # opens Xcode
npm run open:android     # opens Android Studio
```

Or to run on a connected device / simulator:

```sh
npm run run:ios
npm run run:android
```

## How "ship only the simulator view" works

Each fat-snag screen wraps its content in:

```html
<div class="stage">
  <div class="caption"> 01 · iOS splash …</div>
  <div class="device device--splash">
    <div class="island"></div>
    <!-- screen content -->
    <div class="home"></div>
  </div>
</div>
```

The `web-overrides/capacitor-init.js` script adds a `cap-app` class to `<html>` and `<body>` whenever it detects it is running inside Capacitor (via `window.Capacitor.isNativePlatform()`, the `capacitor:` URL scheme, or the Capacitor user-agent string).

Then `web-overrides/capacitor-overrides.css` (also injected into every HTML file's `<head>`) does:

- Hides `.caption`, `.island`, `.home`, `.tweaks`
- Removes the `.device` border-radius and shadow (no fake bezel)
- Anchors `.stage` to top-left and replaces the inline `transform` with `scale(min(100vw / 402px, 100vh / 874px))` so the 402 × 874 design fills the device viewport

Because the rules are scoped to `body.cap-app`, the same `www/` build is identical to the regular Next.js dev experience when opened in a desktop browser — no toggling needed.

## Changes made to the `fat-snag` repo

To make the app statically exportable for Capacitor, I made two minimal edits in `fat-snag/`:

1. **`next.config.ts`** — opt into static export when `STATIC_EXPORT=1` is set:
   ```ts
   const isStaticExport = process.env.STATIC_EXPORT === "1";
   const nextConfig: NextConfig = isStaticExport
     ? { output: "export", images: { unoptimized: true }, trailingSlash: true }
     : {};
   ```
2. **`generateStaticParams`** added to each dynamic-route page so static export can resolve them:
   - `app/browse/[id]/page.tsx` — every gear ID from `browse-data.ts`
   - `app/browse/crew/[id]/page.tsx` — every crew ID
   - `app/projects/[id]/page.tsx` — placeholder ID (real IDs are user-created in localStorage; client-side router handles those at runtime)
   - `app/dashboard/projects/[id]/setup/page.tsx` — placeholder
   - `app/dashboard/projects/[id]/team/page.tsx` — placeholder
   - `app/dashboard/projects/[id]/comparison/[comparisonId]/page.tsx` — placeholder
   - `app/dashboard/packaging/deck/[deckId]/page.tsx` — placeholder

Both changes are gated/harmless and have no effect on regular `npm run dev` / `npm run build` of the fat-snag repo.

## Known limitations

- **Snagger AI route handler** (`app/dashboard/api/snagger/route.ts`) — POST handlers are not supported in Next.js static export. The build script (`scripts/build-web.mjs`) temporarily moves the file aside during the build and restores it afterwards. The Snagger chat feature in the dashboard will not function inside the bundled native app. To re-enable it, point the client (`app/dashboard/components/SnaggerChat.tsx`) at a hosted backend URL via env var and use `NEXT_PUBLIC_*`.
- **User-created project pages** (`/projects/<uuid>`, etc.) only work when reached via in-app navigation. A cold load on those URLs will hit a 404 — Capacitor users always start at `index.html` so this is fine in practice.
- **App icon and splash assets** are still the Capacitor defaults. Generate real ones with [`@capacitor/assets`](https://capacitorjs.com/docs/guides/splash-screens-and-icons) when you want to ship.
