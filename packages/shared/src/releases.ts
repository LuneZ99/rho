import { z } from "zod";

export const releaseVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-test\.(\d{6})\.([1-9]\d*))?$/;
export const releaseSchema = z.object({
  version: z.string().regex(releaseVersion),
  versionCode: z.number().int().positive().max(2100000000),
  publishedAt: z.string().datetime(),
  notes: z.string().min(1).max(10000),
  size: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  certificateSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const releaseCatalogSchema = z
  .array(releaseSchema)
  .superRefine((items, ctx) => {
    if (
      new Set(items.map((r) => r.version)).size !== items.length ||
      new Set(items.map((r) => r.versionCode)).size !== items.length
    )
      ctx.addIssue({ code: "custom", message: "发布版本和安装编号不能重复" });
  });
export type Release = z.infer<typeof releaseSchema>;
export const releasePath = (version: string) =>
  `/downloads/releases/rho-${version}.apk`;
export const releaseDownloadPattern =
  /^\/downloads\/releases\/rho-((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-test\.\d{6}\.[1-9]\d*)?)\.apk$/;
