import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, basename } from "node:path";
import {
  releaseCatalogSchema,
  releaseSchema,
  releasePath,
} from "../packages/shared/src/releases.ts";

// Read version and signing identity from the actual APK, never a caller-supplied label.
const [apk, notesFile, mode] = process.argv.slice(2);
if (!apk || !notesFile)
  throw new Error(
    "用法：tsx scripts/archive-release.mts APK 更新说明.md；需提供 aapt 和 apksigner",
  );
const root = resolve(process.env.RHO_DOWNLOADS_DIR ?? "artifacts", "releases");
await mkdir(root, { recursive: true });
const lock = resolve(root, ".archive-lock");
await mkdir(lock); // Exclusive writer; never overwrite another publisher's catalog.
try {
  const badging = execFileSync(
    process.env.AAPT ?? "aapt",
    ["dump", "badging", apk],
    { encoding: "utf8" },
  );
  const match = badging.match(
    /package: name='plus\.corgi\.rho' versionCode='(\d+)' versionName='([^']+)'/,
  );
  if (!match) throw new Error("安装包不是 rho，或无法读取版本");
  const cert = execFileSync(
    process.env.APKSIGNER ?? "apksigner",
    ["verify", "--print-certs", apk],
    { encoding: "utf8" },
  )
    .match(/Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})/i)?.[1]
    ?.toLowerCase();
  const bytes = await readFile(apk);
  const release = releaseSchema.parse({
    version: match[2],
    versionCode: Number(match[1]),
    publishedAt: new Date().toISOString(),
    notes: (await readFile(notesFile, "utf8")).trim(),
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    certificateSha256: cert,
  });
  let previous: ReturnType<typeof releaseCatalogSchema.parse> = [];
  try {
    previous = releaseCatalogSchema.parse(
      JSON.parse(await readFile(resolve(root, "index.json"), "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (previous.some((r) => r.certificateSha256 !== release.certificateSha256))
    throw new Error("签名与已归档版本不一致，不能覆盖更新");
  const existing = previous.find(
    (r) =>
      r.version === release.version || r.versionCode === release.versionCode,
  );
  if (existing) {
    if (
      existing.version === release.version &&
      existing.versionCode === release.versionCode &&
      existing.sha256 === release.sha256
    ) {
      console.log(`已归档 ${release.version}，保持原发布记录`);
    } else
      throw new Error("此版本或安装编号已发布；请递增版本，禁止覆盖历史包");
  } else {
    if (
      mode !== "--import" &&
      previous.some((r) => r.versionCode >= release.versionCode)
    )
      throw new Error(
        "新发布的安装编号必须大于全部历史版本；迁移原始旧包请显式使用 --import",
      );
    const filename = basename(releasePath(release.version));
    const destination = resolve(root, filename);
    try {
      await copyFile(apk, destination, constants.COPYFILE_EXCL);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== "EEXIST" ||
        createHash("sha256")
          .update(await readFile(destination))
          .digest("hex") !== release.sha256
      )
        throw error;
    }
    await writeFile(
      `${destination}.sha256`,
      `${release.sha256}  ${filename}\n`,
    );
    const catalog = releaseCatalogSchema
      .parse([...previous, release])
      .sort((a, b) => b.versionCode - a.versionCode);
    await writeFile(
      resolve(root, "index.json.next"),
      JSON.stringify(catalog, null, 2) + "\n",
    );
    await rename(resolve(root, "index.json.next"), resolve(root, "index.json"));
    console.log(`已归档 ${release.version} (${release.versionCode})`);
  }
} finally {
  await rm(lock, { recursive: true });
}
