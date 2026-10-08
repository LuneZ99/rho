import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/api.js";
import { releasePath } from "@rho/shared/releases";

test("发布列表、新旧 APK、空状态和公开访问边界", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rho-releases-"));
  const previous = process.env.RHO_DOWNLOADS_DIR;
  process.env.RHO_DOWNLOADS_DIR = dir;
  const app = createApp("t".repeat(40));
  try {
    assert.deepEqual((await app.inject("/releases.json")).json(), []);
    await mkdir(join(dir, "releases"));
    const releases = [
      { version: "0.1.1", versionCode: 2 },
      { version: "0.2.0-test.261008.1", versionCode: 3 },
    ].map((r) => ({
      ...r,
      notes: "发布说明",
      publishedAt: "2026-10-08T00:00:00.000Z",
      size: 3,
      sha256: "a".repeat(64),
      certificateSha256: "b".repeat(64),
    }));
    await writeFile(join(dir, "releases/index.json"), JSON.stringify(releases));
    for (const r of releases)
      await writeFile(join(dir, `releases/rho-${r.version}.apk`), "apk");
    const list = await app.inject("/releases.json");
    assert.equal(list.statusCode, 200);
    assert.equal(list.json()[0].versionCode, 3);
    assert.equal(list.headers["cache-control"], "no-store");
    for (const r of releases) {
      const result = await app.inject(releasePath(r.version));
      assert.equal(result.statusCode, 200);
      assert.equal(result.body, "apk");
      assert.match(String(result.headers["content-disposition"]), /attachment/);
      assert.equal(
        (await app.inject({ method: "HEAD", url: releasePath(r.version) }))
          .statusCode,
        200,
      );
    }
    assert.equal((await app.inject(releasePath("0.0.1"))).statusCode, 404);
    for (const url of [
      "/downloads/releases/.env",
      "/downloads/releases/index.json",
      "/v1/sync",
    ])
      assert.equal((await app.inject(url)).statusCode, 401);
    assert.equal(
      (await app.inject({ method: "POST", url: "/releases.json" })).statusCode,
      401,
    );
    await writeFile(join(dir, "releases/rho-0.1.1.apk"), "truncated");
    assert.equal((await app.inject(releasePath("0.1.1"))).statusCode, 503);
    await rm(join(dir, "releases/rho-0.1.1.apk"));
    assert.equal((await app.inject(releasePath("0.1.1"))).statusCode, 404);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.RHO_DOWNLOADS_DIR;
    else process.env.RHO_DOWNLOADS_DIR = previous;
    await rm(dir, { recursive: true });
  }
});
