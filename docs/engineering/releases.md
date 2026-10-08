# Android 版本与发布

产品行为见[产品需求](../product.md#外观与发布版本2026-10-08-确认)。App 的唯一版本配置为 `apps/mobile/app.json`；npm workspace 的包版本不是安装版本。

## 版本规则

- 正式版：`主版本.功能版本.修订版本`。不兼容变化递增主版本，新增功能递增功能版本，问题修复递增修订版本。
- 测试版：`目标正式版本-test.YYmmdd.当日序号`，日期按北京时间，序号从 1 开始。例如 `0.2.0-test.261008.1`。发布后不复用版本名，不覆盖已发布 APK。
- `android.versionCode` 是独立递增的正整数，每次发布比所有已发布包大。测试版转正式版也继续递增，不从日期或显示版本推算。本次为 3，上一版为 2。
- APK 使用同一 `plus.corgi.rho` 包名及签名。Android 用安装编号防止降级；下载旧版不等于支持保留数据降级。见 [Android 版本规则](https://developer.android.com/studio/publish/versioning)。

## 跨机器开发与发布

代码、版本配置、每版更新说明、构建脚本和公开发布清单全部通过 Git 同步。大型已签名 APK 放在本仓库 GitHub Releases；App 从现有 rho 服务下载，避免手机访问 GitHub 受限。新机器不依赖旧机器的构建缓存、node_modules 或未跟踪脚本。

1. 拉取 Git，安装 Node.js 22.19+、Docker，执行 `npm ci`。
2. 仅开发、检查或恢复历史下载不需要私钥。恢复安装包运行 `npx tsx scripts/restore-releases.mts`，从 Git 中的 `releases/catalog.json` 下载 GitHub 对应版本资产，逐个核对大小与 SHA-256，再原子更新本地列表与原指南的最新下载入口。
3. 构建覆盖更新包时，需从密码管理器或安全备份恢复 `.local/rho-release.keystore` 和 `.local/signing.password`，设置目录权限 700、文件权限 600。这两个文件不能明文进入公开 Git；丢失原签名后无法为现有安装提供普通覆盖更新。构建遇到缺失签名会停止，不自动生成新身份。
4. 修改 `apps/mobile/app.json` 的显示版本及递增安装编号，在 `releases/<版本>.md` 写更新说明；执行类型检查、相关行为测试，再运行 `npm run android:build`。
5. 构建脚本先归档旧下载，再生成新 APK。归档从实际 APK 读取包名、版本、签名及 SHA-256；拒绝签名变化、重复编号、修改同版包和非递增的新发布。它保留 `artifacts/releases/rho-<版本>.apk`，最后原子更新 `index.json`。相同包可重复归档，已有旧包可用 `--import` 迁入。
6. 安装、验证 APK 后，把每版 APK 和 `.sha256` 上传至 GitHub Release `v<版本>`（测试版标记 prerelease），使用该版 Markdown 更新说明；发布资产禁止覆盖。确认上传校验一致后，将 `artifacts/releases/index.json` 复制到 `releases/catalog.json`，提交并推送。历史恢复只以此清单为准，未发布的包不能先进入清单。
7. 发布服务将 `artifacts/` 挂为只读下载卷；仅代码变化需重建 API。不需要为发布列表重启 worker。恢复或新增安装包后，API 每次读取清单，手机刷新即生效。

服务器 `.env` 与业务数据库同样不是 Git 内容，新服务端部署仍按部署文档配置；开发、测试发布页不需要业务密钥。签名备份、服务配置和业务数据不应混入公开下载资产。

## 公开接口与边界

- `GET /releases.json`：按安装编号降序返回公开清单，禁用缓存；不存在清单返回空列表，损坏清单返回错误。
- `GET /downloads/releases/rho-<版本>.apk`：仅提供清单内对应文件，校验文件大小，固定响应为下载。历史 APK 使用不可变缓存。其他文件、目录和写入方法不开放。
- 原 `/downloads/rho-demo.apk` 保留为最新兼容入口；不用于历史卡片。
- 手机列表固定使用项目公开发布服务，不向下载地址发送手机访问令牌。请求超时 15 秒，退出页面取消；加载、空列表、重试和刷新失败状态明确。
- 归档迁入日期不冒充原发布时间：0.1.1 的更新说明注明迁入时间含义；缺失的 0.1.0 原始包不重新构建冒充旧包。
