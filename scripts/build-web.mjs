#!/usr/bin/env node
/*
 * Builds the fat-snag Next.js app as a static export, copies the result into
 * ./www, and injects the Capacitor override stylesheet and init script into
 * every HTML file's <head>.
 *
 * Usage: node scripts/build-web.mjs
 *
 * Env:
 *   FAT_SNAG_DIR  Override the path to the fat-snag repo (default: ../fat-snag)
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const FAT_SNAG_DIR = resolve(process.env.FAT_SNAG_DIR || join(ROOT, "..", "fat-snag"));
const OUT_DIR = join(FAT_SNAG_DIR, "out");
const WWW_DIR = join(ROOT, "www");
const OVERRIDES_DIR = join(ROOT, "web-overrides");

const POST_API_ROUTE = join(FAT_SNAG_DIR, "app", "dashboard", "api", "snagger", "route.ts");
const POST_API_STASH = POST_API_ROUTE + ".capacitor-stash";

function log(...args) {
  console.log("[build-web]", ...args);
}

function run(cmd, args, opts = {}) {
  log("$", cmd, args.join(" "));
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} exited with status ${r.status}`);
  }
}

function ensureFatSnag() {
  if (!existsSync(FAT_SNAG_DIR)) {
    throw new Error(`fat-snag not found at ${FAT_SNAG_DIR} — set FAT_SNAG_DIR env var.`);
  }
  if (!existsSync(join(FAT_SNAG_DIR, "package.json"))) {
    throw new Error(`No package.json in ${FAT_SNAG_DIR}.`);
  }
  if (!existsSync(join(FAT_SNAG_DIR, "node_modules"))) {
    log("Installing fat-snag dependencies...");
    run("npm", ["install"], { cwd: FAT_SNAG_DIR });
  }
}

function stashPostApiRoute() {
  if (existsSync(POST_API_ROUTE)) {
    log("Temporarily moving POST API route aside (incompatible with static export):");
    log("  ", POST_API_ROUTE);
    renameSync(POST_API_ROUTE, POST_API_STASH);
  }
}

function restorePostApiRoute() {
  if (existsSync(POST_API_STASH)) {
    renameSync(POST_API_STASH, POST_API_ROUTE);
    log("Restored POST API route.");
  }
}

function buildStaticExport() {
  log("Building fat-snag static export (STATIC_EXPORT=1)...");
  run("npm", ["run", "build"], {
    cwd: FAT_SNAG_DIR,
    env: { ...process.env, STATIC_EXPORT: "1" },
  });
  if (!existsSync(OUT_DIR)) {
    throw new Error(`Expected static export at ${OUT_DIR} — build did not produce it.`);
  }
}

function copyToWww() {
  log("Copying static export to", WWW_DIR);
  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(WWW_DIR, { recursive: true });
  cpSync(OUT_DIR, WWW_DIR, { recursive: true });
}

function copyOverrides() {
  const dest = join(WWW_DIR, "_capacitor");
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(OVERRIDES_DIR)) {
    cpSync(join(OVERRIDES_DIR, file), join(dest, file));
  }
  log("Copied web-overrides into www/_capacitor/");
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const INJECTED_TAGS = [
  '<link rel="stylesheet" href="/_capacitor/capacitor-overrides.css">',
  '<script src="/_capacitor/capacitor-init.js"></script>',
].join("");

function injectOverridesIntoHtml() {
  let injected = 0;
  for (const f of walk(WWW_DIR)) {
    if (!f.endsWith(".html")) continue;
    let html = readFileSync(f, "utf8");
    if (html.includes("/_capacitor/capacitor-overrides.css")) continue;
    // Insert just before </head> if present, otherwise at the start of <body>.
    if (html.includes("</head>")) {
      html = html.replace("</head>", INJECTED_TAGS + "</head>");
    } else if (html.includes("<body")) {
      html = html.replace(/<body([^>]*)>/, `<body$1>${INJECTED_TAGS}`);
    } else {
      html = INJECTED_TAGS + html;
    }
    writeFileSync(f, html);
    injected++;
  }
  log(`Injected Capacitor overrides into ${injected} HTML file(s).`);
}

async function main() {
  ensureFatSnag();
  stashPostApiRoute();
  try {
    buildStaticExport();
  } finally {
    restorePostApiRoute();
  }
  copyToWww();
  copyOverrides();
  injectOverridesIntoHtml();
  log("Done. Run `npx cap sync` to push www/ into the iOS/Android projects.");
}

main().catch((err) => {
  restorePostApiRoute();
  console.error(err);
  process.exit(1);
});
