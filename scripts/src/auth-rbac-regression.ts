import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const baseUrl = process.env.CWH_BASE_URL ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

if (!baseUrl || !superAdminEmail || !superAdminPassword || !databaseUrl) {
  throw new Error("CWH_BASE_URL or REPLIT_DEV_DOMAIN, Super Admin secrets, and DATABASE_URL are required");
}

const configuredBaseUrl: string = baseUrl;
const configuredSuperAdminEmail: string = superAdminEmail;
const configuredSuperAdminPassword: string = superAdminPassword;
const configuredDatabaseUrl: string = databaseUrl;

type Role = "CLIENT" | "HUB_ADMIN" | "DELIVERY_AGENT" | "SUPER_ADMIN";
type User = { id: number; fullName: string; email: string; role: Role; hubId: number | null };
type AuthResponse = { user?: User };

class CookieJar {
  private readonly cookies = new Map<string, string>();

  update(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [nameValue] = header.split(";");
      const separator = nameValue.indexOf("=");
      if (separator > 0) this.cookies.set(nameValue.slice(0, separator), nameValue.slice(separator + 1));
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

async function request(path: string, init: RequestInit = {}, jar?: CookieJar) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  const cookie = jar?.header();
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${configuredBaseUrl}${path}`, { ...init, headers });
  jar?.update(response);
  const body = await response.json().catch(() => ({})) as AuthResponse;
  return { response, body };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function apiLogin(email: string, password: string) {
  const jar = new CookieJar();
  const result = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }, jar);
  assert(result.response.ok, "API login failed");
  assert(result.body.user?.role, "API login did not return a role");
  return { jar, user: result.body.user as User };
}

async function register(email: string, fullName: string, password: string) {
  const result = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ fullName, email, phoneNumber: "0210000000", password }),
  });
  assert(result.response.status === 201, `Registration failed: ${result.response.status}`);
  return result.body.user as User;
}

async function waitFor<T>(read: () => Promise<T>, predicate: (value: T) => boolean, message: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}

type CdpResult = { result?: { value?: unknown }; exceptionDetails?: { text?: string } };

class BrowserPage {
  private nextId = 1;
  private readonly pending = new Map<number, (value: CdpResult) => void>();
  private readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: CdpResult; error?: { message: string } };
      if (!message.id) return;
      const resolve = this.pending.get(message.id);
      if (!resolve) return;
      this.pending.delete(message.id);
      resolve(message.error ? { exceptionDetails: { text: message.error.message } } : (message.result ?? {}));
    });
  }

  command(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    return new Promise<CdpResult>((resolve) => {
      this.pending.set(id, resolve);
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string) {
    const result = await this.command("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
    return result.result?.value as T;
  }

  async navigate(path: string) {
    await this.command("Page.navigate", { url: `${configuredBaseUrl}${path}` });
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  async signIn(email: string, password: string) {
    await this.navigate("/sign-in");
    await waitFor(
      () => this.evaluate<boolean>('Boolean(document.querySelector(\'form input[type="email"]\'))'),
      Boolean,
      "Sign-in form did not load",
    );
    const values = JSON.stringify({ email, password });
    await this.evaluate(`
      (() => {
        const values = ${values};
        const setValue = (selector, value) => {
          const input = document.querySelector(selector);
          if (!input) throw new Error("Missing sign-in field " + selector);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setValue('input[type="email"]', values.email);
        setValue('input[type="password"]', values.password);
        document.querySelector("form").requestSubmit();
      })()
    `);
  }

  async waitForPath(path: string) {
    try {
      await waitFor(
        () => this.evaluate<string>("location.pathname"),
        (location) => location === path,
        `Expected browser path ${path}`,
      );
    } catch {
      const location = await this.evaluate<string>("location.pathname");
      const text = (await this.bodyText()).replace(/\s+/g, " ").slice(0, 180);
      throw new Error(`Expected browser path ${path}; was ${location}; page: ${text}`);
    }
  }

  async bodyText() {
    return this.evaluate<string>("document.body.innerText");
  }

  async authMe() {
    return this.evaluate<{ status: number; user?: User }>(`
      fetch("/api/auth/me", { credentials: "include" })
        .then(async (response) => ({ status: response.status, ...(await response.json()) }))
    `);
  }

  async logout() {
    await this.evaluate('fetch("/api/auth/logout", { method: "POST", credentials: "include" })');
  }

  close() {
    this.socket.close();
  }
}

async function launchBrowser() {
  const profile = mkdtempSync(`${tmpdir()}/cwh-rbac-`);
  const executable = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? "/repl/tools/bin/chromium";
  const processHandle = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`,
    `${configuredBaseUrl}/sign-in`,
  ]);
  const endpoint = await new Promise<string>((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for Chromium")), 10_000);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[1]);
      }
    };
    processHandle.stderr.on("data", onData);
    processHandle.stdout.on("data", onData);
    processHandle.once("error", reject);
  });
  const debugUrl = new URL(endpoint);
  const browserJsonUrl = `http://${debugUrl.host}`;
  const targets = await fetch(`${browserJsonUrl}/json/list`).then((response) => response.json()) as { type: string; webSocketDebuggerUrl: string }[];
  const target = targets.find((item) => item.type === "page");
  assert(target, "Chromium did not expose a page target");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to Chromium")), { once: true });
  });
  const page = new BrowserPage(socket);
  await page.command("Runtime.enable");
  await page.command("Page.enable");
  return {
    page,
    processHandle,
    cleanup: async () => {
      page.close();
      if (!processHandle.killed) processHandle.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        if (processHandle.exitCode !== null) {
          resolve();
          return;
        }
        processHandle.once("exit", () => resolve());
      });
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}

function cleanupUsers(emails: string[]) {
  assert(emails.every((email) => /^[a-z0-9-]+@example\.test$/.test(email)), "Unexpected generated test email");
  const quotedEmails = emails.map((email) => `'${email}'`).join(", ");
  const sql = `
    DELETE FROM auth_sessions
    WHERE user_id IN (SELECT id FROM users WHERE email IN (${quotedEmails}));
    DELETE FROM users
    WHERE email IN (${quotedEmails});
  `;
  execFileSync("psql", [
    configuredDatabaseUrl,
    "--command", sql,
  ], { stdio: "pipe" });
}

async function main() {
  const testPassword = "Cwh-test-password-2026!";
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const emails = [`cwh-client-${suffix}@example.test`, `cwh-hub-${suffix}@example.test`, `cwh-agent-${suffix}@example.test`];
  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined;
  try {
    const [client, hub, agent] = await Promise.all([
      register(emails[0], "RBAC Test Client", testPassword),
      register(emails[1], "RBAC Test Hub", testPassword),
      register(emails[2], "RBAC Test Agent", testPassword),
    ]);
    const admin = await apiLogin(configuredSuperAdminEmail, configuredSuperAdminPassword);
    const updateRole = async (userId: number, role: Role) => {
      const result = await request(`/api/auth/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role, hubId: null }),
      }, admin.jar);
      assert(result.response.ok, `Could not assign ${role}`);
    };
    await updateRole(hub.id, "HUB_ADMIN");
    await updateRole(agent.id, "DELIVERY_AGENT");

    browser = await launchBrowser();
    const { page } = browser;

    await page.signIn(configuredSuperAdminEmail, configuredSuperAdminPassword);
    await page.waitForPath("/command");
    assert((await page.bodyText()).includes("The whole picture, clearly."), "Super Admin did not land on the command centre");
    const me = await page.authMe();
    assert(me.status === 200 && me.user?.role === "SUPER_ADMIN", "The browser session was not accepted by /api/auth/me");
    await page.navigate("/orders");
    await page.waitForPath("/command");
    assert(!(await page.bodyText()).includes("Fulfillment queue"), "Super Admin reached the Hub Admin workspace");
    await page.logout();

    const roleCases = [
      { email: emails[0], expected: "/shop", heading: "Good food, fairly priced.", blocked: "/command" },
      { email: emails[1], expected: "/orders", heading: "Fulfillment queue", blocked: "/deliveries" },
      { email: emails[2], expected: "/deliveries", heading: "Today's drops", blocked: "/orders" },
    ];
    for (const roleCase of roleCases) {
      await page.signIn(roleCase.email, testPassword);
      await page.waitForPath(roleCase.expected);
      assert((await page.bodyText()).includes(roleCase.heading), `Generated role account did not reach ${roleCase.expected}`);
      await page.navigate("/command");
      await page.waitForPath(roleCase.expected);
      await page.navigate(roleCase.blocked);
      await page.waitForPath(roleCase.expected);
      if (roleCase.expected === "/shop") {
        await page.navigate("/orders");
        await page.waitForPath("/orders");
        assert((await page.bodyText()).includes("Orders in motion"), "Client lost the intentional order-status route");
      }
      await page.logout();
    }

    console.log("Auth/RBAC regression passed: Super Admin session plus Client, Hub Admin, and Delivery Agent landing and boundary routes.");
  } finally {
    if (browser) await browser.cleanup();
    cleanupUsers(emails);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});