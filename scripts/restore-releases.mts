import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  copyFile,
  rm,
} from "node:fs/promises";
import { resolve, basename } from "node:path";
import {
  releaseCatalogSchema,
  releasePath,
} from "../packages/shared/src/releases.ts";

// Git carries the manifest; GitHub Releases carries signed APKs, without private keys.
const catalog = releaseCatalogSchema
  .parse(JSON.parse(await readFile("releases/catalog.json", "utf8")))
  .sort((a, b) => b.versionCode - a.versionCode);
const root = resolve(process.env.RHO_DOWNLOADS_DIR ?? "artifacts", "releases");
await mkdir(root, { recursive: true });
const lock = resolve(root, ".archive-lock");
await mkdir(lock);
try {
  let local: typeof catalog = [];
  try {
    local = releaseCatalogSchema.parse(
      JSON.parse(await readFile(resolve(root, "index.json"), "utf8")),
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  // Do not silently discard versions that haven't yet been synchronized to Git.
  if (
    local.some(
      (r) =>
        !catalog.some((c) => c.version === r.version && c.sha256 === r.sha256),
    )
  )
    throw new Error(
      "本地包含尚未同步到 Git 的发布记录，先完成发布和同步再恢复",
    );
  for (const release of catalog) {
    const name = basename(releasePath(release.version));
    const file = resolve(root, name);
    let bytes: Uint8Array | undefined;
    try {
      bytes = await readFile(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    if (!bytes) {
      const response = await fetch(
        `https://github.com/LuneZ99/rho/releases/download/v${release.version}/${name}`,
        { signal: AbortSignal.timeout(300000) },
      );
      if (!response.ok)
        throw new Error(`下载 ${name} 失败：${response.status}`);
      bytes = new Uint8Array(await response.arrayBuffer());
    }
    if (
      bytes.length !== release.size ||
      createHash("sha256").update(bytes).digest("hex") !== release.sha256
    )
      throw new Error(`${name} 校验失败，未修改发布列表`);
    await writeFile(`${file}.next`, bytes);
    await rename(`${file}.next`, file);
    await writeFile(`${file}.sha256`, `${release.sha256}  ${name}\n`);
    console.log(`已恢复 ${release.version}`);
  }
  await writeFile(
    resolve(root, "index.json.next"),
    JSON.stringify(catalog, null, 2) + "\n",
  );
  await rename(resolve(root, "index.json.next"), resolve(root, "index.json"));

  if (catalog.length) {
    const latest = catalog[0];
    const alias = resolve(root, "../rho-demo.apk");
    await copyFile(
      resolve(root, basename(releasePath(latest.version))),
      `${alias}.next`,
    );
    await rename(`${alias}.next`, alias);
    await writeFile(`${alias}.sha256`, `${latest.sha256}  rho-demo.apk\n`);
  }
} finally {
  await rm(lock, { recursive: true });
}
