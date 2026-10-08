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
    assert.match((await app.inject("/")).body, /暂无发布版本/);
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
    for (const path of ["/", "/guide", "/guide/"]) {
      const page = await app.inject(path);
      assert.equal(page.statusCode, 200);
      assert.match(page.body, /id="releases"/);
      assert.ok(
        page.body.includes(`href="${releasePath(releases[0].version)}"`),
      );
      assert.ok(
        page.body.includes(`href="${releasePath(releases[1].version)}"`),
      );
      assert.ok(
        page.body.indexOf(`<h3>${releases[1].version}</h3>`) <
          page.body.indexOf(`<h3>${releases[0].version}</h3>`),
      );
      assert.match(page.body, /测试步骤/);
    }
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
    releases[0].notes = '<script>alert("test")</script>';
    await writeFile(join(dir, "releases/index.json"), JSON.stringify(releases));
    const escaped = await app.inject("/");
    assert.ok(!escaped.body.includes("<script>"));
    assert.match(escaped.body, /&lt;script&gt;/);
    await writeFile(join(dir, "releases/index.json"), "invalid");
    const fallback = await app.inject("/");
    assert.equal(fallback.statusCode, 200);
    assert.match(fallback.body, /暂时无法读取发布列表/);
    assert.match(fallback.body, /测试步骤/);
  } finally {
    await app.close();
    if (previous === undefined) delete process.env.RHO_DOWNLOADS_DIR;
    else process.env.RHO_DOWNLOADS_DIR = previous;
    await rm(dir, { recursive: true });
  }
});
