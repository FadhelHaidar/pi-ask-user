import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach } from "vitest";

const home = mkdtempSync(join(tmpdir(), "pi-ask-user-test-"));
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.PI_CODING_AGENT_DIR;
delete process.env.XDG_CONFIG_HOME;

beforeEach(async () => {
  delete process.env.PI_CODING_AGENT_DIR;
  delete process.env.XDG_CONFIG_HOME;
  const i18n = await import("@juicesharp/rpiv-i18n");
  i18n.__resetState();
  rmSync(join(home, ".config"), { recursive: true, force: true });
});
afterAll(() => rmSync(home, { recursive: true, force: true }));
