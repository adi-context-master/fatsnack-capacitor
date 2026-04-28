# Backend Engineer Setup Guide — Fat Snag Mobile (Capacitor)

This guide takes you from a fresh macOS machine to building, running, and editing the Fat Snag iOS and Android apps. The mobile shell is in this repo; the actual UI lives in the [`fat-snag`](https://github.com/FatSnag/fat-snag) Next.js repo, which the build pipeline pulls from a sibling directory.

> **Linux / Windows users**: iOS builds require macOS + Xcode. Android builds work on any OS — adapt brew commands to apt/choco. The rest of the guide is the same.

---

## 0 · What you're getting into

```
Code/
├── fat-snag/                  # Next.js source — the actual screens
└── Fatsnack Capacitor/        # this repo — native shell
    ├── scripts/build-web.mjs  # builds fat-snag → static export → www/
    ├── web-overrides/         # CSS+JS injected into every page
    ├── ios/                   # Xcode project (generated)
    ├── android/               # Android Studio project (generated)
    └── www/                   # built web output (generated, gitignored)
```

The build pipeline:

1. `STATIC_EXPORT=1` `next build` in `fat-snag/` — produces `out/`
2. Copy `out/` → `www/`
3. Inject `_capacitor/capacitor-init.js` + `_capacitor/capacitor-overrides.css` into every HTML file's `<head>`. These hide the on-page iPhone simulator decoration (caption, fake Dynamic Island, fake home indicator, rounded bezel) when running inside Capacitor, and rescale screen content to fill the device viewport.
4. `cap sync` copies `www/` into `ios/App/App/public/` and `android/app/src/main/assets/public/`.

---

## 1 · Prerequisites (one-time install)

### Common
```bash
# Homebrew (skip if already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node 18+ (we test on 24)
brew install node
```

### iOS only
```bash
# Xcode — open the App Store, install Xcode, then accept the license:
sudo xcodebuild -license accept

# CocoaPods (used by Capacitor's iOS plugin to manage native deps)
brew install cocoapods
```

### Android only
```bash
# JDK 21 (Capacitor 7 + AGP 8.x require 17 or 21; we standardize on 21)
brew install openjdk@21

# Android command-line tools (sdkmanager, adb, avdmanager)
brew install --cask android-commandlinetools

# Persist the env. Add these lines to ~/.zshrc (or ~/.bashrc):
cat >> ~/.zshrc <<'EOF'

# Java
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
export PATH="$JAVA_HOME/bin:$PATH"

# Android SDK
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
EOF
exec zsh   # reload your shell

# Accept SDK licenses + install platform 35 and build-tools 35.0.0
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

> **Why platform 35?** The generated `android/app/build.gradle` targets `compileSdk` and `targetSdk` 35 (Android 15). Bump both numbers together if you raise it.

> **Optional — emulator + system image**: if you don't have a physical Android device:
> ```bash
> sdkmanager "emulator" "system-images;android-35;google_apis;arm64-v8a"
> avdmanager create avd -n FatSnag -k "system-images;android-35;google_apis;arm64-v8a" -d "pixel_7"
> emulator -avd FatSnag &  # leave running, then run the app
> ```

### Sanity check
```bash
node --version    # v18 or higher
java -version     # 21.x
sdkmanager --version
adb --version
pod --version     # iOS only
xcodebuild -version  # iOS only
```

---

## 2 · Clone the two repos

They must be **siblings** (same parent directory):

```bash
mkdir -p ~/Code && cd ~/Code

git clone https://github.com/FatSnag/fat-snag.git
git clone https://github.com/adi-context-master/fatsnack-capacitor.git "Fatsnack Capacitor"

cd "Fatsnack Capacitor"
npm install
```

> **Different layout?** If you keep `fat-snag` somewhere else, run `FAT_SNAG_DIR=/path/to/fat-snag npm run build:web`.

---

## 3 · First build

### Build the web bundle
```bash
npm run build:web
# → builds fat-snag with STATIC_EXPORT=1
# → copies out/ to www/
# → injects Capacitor overrides into 130 HTML files
```

### Add and sync the native projects
```bash
# iOS — only after CocoaPods is installed
npx cap add ios

# Android — already in this repo. Skip unless you blew it away.
# npx cap add android

# Push the latest www/ into ios/ and android/
npx cap sync
```

### Generate icons + splash from the logo
```bash
# Renders fat-snag's logo-red.svg → assets/*.png
node scripts/svg2png.mjs ../fat-snag/public/logo-red.svg assets/icon-only.png 1024
node scripts/svg2png.mjs ../fat-snag/public/logo-red.svg assets/splash.png 2732

# Generate every iOS / Android / PWA size variant
npx capacitor-assets generate \
  --iconBackgroundColor      "#fabf2a" \
  --iconBackgroundColorDark  "#fabf2a" \
  --splashBackgroundColor    "#fabf2a" \
  --splashBackgroundColorDark "#fabf2a"
```

> Re-run only when the source logo changes.

---

## 4 · Run on iOS

```bash
# Boot a simulator (only need to do this once per session)
open -a Simulator
xcrun simctl boot "iPhone 17 Pro"   # any model works

# Build, install, and launch
npx cap run ios
# (or)
npm run open:ios   # opens Xcode if you prefer to run from there
```

To run on a **physical iPhone**:
1. Connect via USB, trust the computer.
2. `npm run open:ios` → in Xcode, pick your phone in the device dropdown.
3. **Signing & Capabilities** → set your Apple Developer "Team". You'll see a "Failed to register bundle identifier" error if `com.fatsnag.app` is taken — change it to `com.<yourname>.fatsnag.app` while testing.
4. ⌘R to run.

---

## 5 · Run on Android

```bash
# Either start an emulator (see step 1 optional) or plug in a phone with USB debugging on.
adb devices   # confirm the device shows up

# Build, install, and launch
npx cap run android
# (or)
npm run open:android   # opens Android Studio
```

To install a debug APK manually:
```bash
cd android
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

---

## 6 · Day-to-day workflow

```bash
# After ANY change to the fat-snag UI:
npm run build           # = build:web + cap sync

# Then re-run on the platform:
npx cap run ios
# or
npx cap run android
```

For faster iteration, point Capacitor at fat-snag's dev server instead of rebuilding the static export every time:

1. Run `npm run dev` in `fat-snag/` (it serves on `localhost:3000`).
2. Find your machine's LAN IP (`ipconfig getifaddr en0`).
3. Add to `capacitor.config.ts` temporarily:
   ```ts
   server: { url: "http://192.168.x.x:3000", cleartext: true }
   ```
4. `npx cap sync && npx cap run ios` — the app loads from the dev server with hot reload.
5. **Remove `server` before committing or shipping** — production builds must use the bundled `www/`.

---

## 7 · Editing the simulator-decoration overrides

The two files in `web-overrides/` control how the on-page iPhone simulator decoration is hidden when running inside Capacitor:

- **`capacitor-init.js`** — runs early, marks `<html>`/`<body>` with `cap-app`, forces `viewport-fit=cover`, and continuously rescales every `.stage` element to fill the device. Reads safe-area insets from a hidden `.cap-safe-probe` element.
- **`capacitor-overrides.css`** — scoped to `body.cap-app`. Hides `.caption`, `.island`, `.home`, `.tweaks`, strips bezel `border-radius` + `box-shadow`, and uses CSS variables (`--cap-tx`, `--cap-ty`, `--cap-scale`) with `!important` so it wins against fat-snag's per-screen inline transform.

After editing either file, run `npm run build` to rebuild and re-inject. They live under `www/_capacitor/` after build.

---

## 8 · Known limitations

| Area | What's wrong | Workaround |
|---|---|---|
| Snagger AI chat (`POST /dashboard/api/snagger`) | Static export drops POST routes. The build script temporarily moves it aside. | Host the API somewhere (Vercel, Cloudflare Workers) and update `app/dashboard/components/SnaggerChat.tsx` to use `NEXT_PUBLIC_SNAGGER_URL`. |
| User-created project pages (`/projects/<uuid>`) | No pre-rendered HTML for runtime IDs. | Works as long as the user reaches them via in-app navigation (Capacitor users always start at `index.html`, so this is fine). A cold load on `/projects/abc` from a deep link will 404. |
| Camera (GearScan) / geolocation | No Capacitor plugins wired yet. | `npm i @capacitor/camera @capacitor/geolocation && npx cap sync`, then update GearScan / browse-map screens to use them. |
| App Tracking Transparency, push notifications, deep links, etc. | Not configured. | Add the relevant Capacitor plugins as features need them. |
| Code signing | iOS uses Apple's automatic signing with a placeholder team; Android has no release keystore. | Set up Apple Developer team in Xcode and a Play Store keystore before TestFlight / Play release. |

---

## 9 · Common errors

**`pod: command not found`** (iOS)
→ `brew install cocoapods`

**`Could not find installation of TypeScript`** (cap CLI)
→ `npm install -D typescript` in this repo. (Already in `devDependencies`, so `npm install` should fix.)

**`fat-snag not found at …`** (build script)
→ Either clone fat-snag as `../fat-snag`, or set `FAT_SNAG_DIR=/path/to/fat-snag`.

**`SDK location not found. Define ANDROID_HOME …`** (Gradle)
→ Either set the env var in your shell, or write `sdk.dir=/opt/homebrew/share/android-commandlinetools` into `android/local.properties` (gitignored, per-machine).

**`Failed to install the requested application` / blank black screen on iOS**
→ App was already installed in the simulator and got into a bad state. Run `xcrun simctl uninstall booted com.fatsnag.app` and re-launch.

**`License for package … not accepted`** (Android)
→ `yes | sdkmanager --licenses`

**`Unsupported class file major version`** (Android)
→ Wrong JDK. Check `java -version` shows 21, and `JAVA_HOME` points at OpenJDK 21.

**Web changes don't show up in the app**
→ You forgot `npx cap sync` (or use `npm run build` which does both `build:web` and `sync`).

---

## 10 · Where to ask

- Capacitor docs: https://capacitorjs.com/docs
- This repo: https://github.com/adi-context-master/fatsnack-capacitor
- fat-snag (UI source): https://github.com/FatSnag/fat-snag
