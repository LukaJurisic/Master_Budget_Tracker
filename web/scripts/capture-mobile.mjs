import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);

const readArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return undefined;
  return args[index + 1];
};

const hasArg = (name) => args.includes(name);

const baseUrl = readArg("--base-url") ?? process.env.PW_BASE_URL ?? "http://localhost:3000";
const deviceName = readArg("--device") ?? process.env.PW_DEVICE ?? "iPhone 13";
const waitMsRaw = readArg("--wait-ms") ?? process.env.PW_WAIT_MS ?? "1200";
const waitMs = Number.parseInt(waitMsRaw, 10) || 1200;
const throttle = hasArg("--throttle") || process.env.PW_THROTTLE === "1";
const headless = !hasArg("--headed");
const failOnError = hasArg("--fail-on-error");

const targetDevice = devices[deviceName];
if (!targetDevice) {
  const names = Object.keys(devices).slice(0, 25).join(", ");
  throw new Error(`Unknown device "${deviceName}". Example devices: ${names}`);
}

const routes = [
  { name: "home", path: "/" },
  { name: "transactions", path: "/transactions" },
  { name: "mapping", path: "/mapping" },
  { name: "budgets", path: "/budgets" },
  { name: "sources", path: "/sources" },
  { name: "analytics", path: "/analytics" },
  { name: "year-in-review", path: "/year-in-review" },
];

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, "../../artifacts/playwright/mobile", timestamp);

const ensureDir = async () => {
  await fs.mkdir(outputDir, { recursive: true });
};

const safeFile = (value) => value.replace(/[^a-z0-9-_]/gi, "_").toLowerCase();

const toUrl = (base, routePath) => new URL(routePath, base).toString();

const applyThrottle = async (context, page) => {
  if (!throttle) return;
  const client = await context.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 180,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
    connectionType: "cellular3g",
  });
};

const run = async () => {
  await ensureDir();

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    ...targetDevice,
    ignoreHTTPSErrors: true,
  });

  const summary = {
    baseUrl,
    device: deviceName,
    throttle,
    waitMs,
    capturedAt: new Date().toISOString(),
    routes: [],
  };

  for (const route of routes) {
    const page = await context.newPage();
    await applyThrottle(context, page);

    const consoleMessages = [];
    const pageErrors = [];
    const requestFailures = [];

    page.on("console", (msg) => {
      if (msg.type() === "error" || msg.type() === "warning") {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    page.on("pageerror", (err) => {
      pageErrors.push({ message: err.message, stack: err.stack ?? "" });
    });

    page.on("requestfailed", (request) => {
      requestFailures.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText ?? "unknown",
      });
    });

    const url = toUrl(baseUrl, route.path);
    const screenshotPath = path.join(outputDir, `${safeFile(route.name)}.png`);

    let status = null;
    let ok = false;
    let navError = null;

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      status = response?.status() ?? null;
      ok = response?.ok() ?? false;
      try {
        await page.waitForLoadState("networkidle", { timeout: 8_000 });
      } catch {
        // Ignore noisy pages and still capture snapshot.
      }
      await page.waitForTimeout(waitMs);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      navError = error instanceof Error ? error.message : String(error);
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const routeResult = {
      route: route.name,
      path: route.path,
      url,
      status,
      ok,
      screenshot: path.relative(path.resolve(__dirname, "../.."), screenshotPath).replace(/\\/g, "/"),
      navError,
      consoleMessages,
      pageErrors,
      requestFailures,
    };

    summary.routes.push(routeResult);
    await page.close();
  }

  await browser.close();

  const reportPath = path.join(outputDir, "report.json");
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2), "utf8");

  const totals = summary.routes.reduce(
    (acc, route) => {
      acc.console += route.consoleMessages.length;
      acc.page += route.pageErrors.length;
      acc.network += route.requestFailures.length;
      acc.nav += route.navError ? 1 : 0;
      return acc;
    },
    { console: 0, page: 0, network: 0, nav: 0 }
  );

  console.log(`Saved mobile captures to: ${outputDir}`);
  console.log(`Report: ${reportPath}`);
  console.log(
    `Issues found -> nav: ${totals.nav}, console: ${totals.console}, page: ${totals.page}, network: ${totals.network}`
  );

  if (failOnError && (totals.nav > 0 || totals.console > 0 || totals.page > 0 || totals.network > 0)) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
