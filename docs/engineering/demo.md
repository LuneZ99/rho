# 首个 demo 技术与运行说明

本轮产品行为统一定义在[产品需求](../product.md#第一个-demo2026-10-04-确认)。本文记录实现与运行安排；实际检查结果见[验证记录](verification.md)。

## 组成

- `apps/mobile`：Expo 57、React Native 0.86.3、Expo Router。SQLite 保存离线实体与待提交操作；SecureStore 保存连接凭据。Android 原生提醒模块放在手机工程的 `modules` 内。
- `apps/server`：Node.js 22、Fastify API、独立 Pi worker、PostgreSQL 17。Pi SDK 固定 `@earendil-works/pi-coding-agent@1.0.2`。worker 持有独占锁，串行处理多个会话，避免共享记录和会话文件的并发写入。
- `packages/shared`：实体、操作及校验规则。健康指标没有固定列，使用通用记录字段及 JSON 内容；同类字段命名由 Agent 查询现有记录后复用。
- Pi 的会话文件各自持久化，共享一个工作目录。本轮只开放业务工具，后续完整工具沙箱未实现；不能把当前工具列表当作已满足完整共享工作空间要求。

## 接口和数据

业务接口统一使用 `Authorization: Bearer <rho 访问令牌>`；健康检查、下述固定公开指南地址及[发布下载接口](releases.md#公开接口与边界)除外。

| 接口 | 行为 |
| --- | --- |
| `GET /healthz` | 数据库连接检查，只返回健康状态 |
| `POST /v1/operations` | 提交 `{id, action, payload}`，返回已落库实体 |
| `GET /v1/sync?since=序号` | 返回变更实体、下一游标、是否还有下一页 |
| `GET /v1/jobs/:id/events` | SSE 输出持久消息和任务状态，连接中断不取消任务 |

公开试用指南：`/`、`/guide`、`/guide/`；安装包及校验值：`/downloads/rho-demo.apk`、`/downloads/rho-demo.apk.sha256`；字体和许可位于 `/guide/fonts/` 的固定白名单。仅允许 GET／HEAD 免鉴权，不开放目录浏览或任意文件路径。API 以只读卷读取 `artifacts/`，网页不包含个人凭据或业务记录。

`packages/shared/src/guide.ts` 是 App 与网页的共用指南内容，包含连接说明、具体测试场景与验证范围。手机 `/guide` 和 `/guide/[topic]` 随安装包提供，离线可读；网页版由 API 渲染，更新内容后需重建 API。App 入口在连接设置顶部。同处新增发布版本入口；版本规则、历史 APK 保留和跨机器恢复见[发布说明](releases.md)。

网页使用 MiSans 的 WOFF2 用字子集，两种字重合计约 100 KB；移动端保留完整字体。修改指南文案后，使用安装了 `fonttools`、`brotli` 的 Python 运行 `scripts/build-guide-fonts.py`，同时更新 `apps/server/public/fonts/`，保留官方许可。

实体包含 ID、类型、版本、增量序号、删除标记和内容。类型为会话、消息、任务、记录、卡片、提醒、设备状态。删除使用墓碑，离线手机仍能收到删除变更。

记录区分 module、kind、category、title、content、originalText、fields、occurredAt、dueAt、status 与 sourceConversationId；扩展内容不执行代码。通用待办也可归属健康等模块。

写入、操作回执及审计在同一事务提交；重复操作 ID 只返回原结果，同 ID 不同内容拒绝。更新检查版本，拒绝静默覆盖。事务级锁保证序号按提交顺序可见，防止增量同步漏项；单用户 demo 接受串行写入的吞吐限制。

任务状态为 queued / running / completed / failed / interrupted。服务重启将运行中任务标记为中断；用户点“检查进度并继续”后，向 Agent 提供已提交工具结果及原会话，先检查再继续。工具调用按任务 ID 与调用 ID 去重。新模型决策仍需依赖当前记录检查，不能声称对任意外部动作提供 exactly-once 保证；本轮未开放此类动作。

## 离线与通知

- 待提交队列保存在 SQLite，按顺序发送；冲突保留输入，继续拉取最新数据，用户处理冲突后继续提交。
- 普通 JSON 请求使用 React Native fetch，进度流使用 expo/fetch。App 前台且任务活跃时接收 SSE；后台停止进度连接，回来同步。断网等待重试，不以网络中断取消服务端任务。
- 原生模块使用 AlarmManager、NotificationManager、SharedPreferences，独立于 React Native JS 生命周期。只安排最近的用户可见闹钟（setAlarmClock），触发时处理到期项目并安排下一次。普通 allow-while-idle 闹钟在 Doze 下可能有九分钟频率限制，因此不用它承诺五分钟目标；未授予精确闹钟权限时明确显示受限状态。系统可能显示下一次闹钟标志。
- 提醒的 ID、版本、触发时间共同标识一次送达；相同版本重新同步保留已推进的重复提醒时间。每天／每周按指定时区的本地日历推进。
- 开机、应用升级、系统时间或精确闹钟权限变化时恢复调度。系统强制停止应用后需重新打开；设备关机期间不能通知。
- 通知关闭时保留待提醒内容，恢复后合并补发。已安排不等于用户已读；本机记录的是系统通知提交结果。
- 五分钟锁屏目标须在索尼 Android 11 验证，模拟器不能证明厂商省电行为或耗电水平。

## Docker Compose 与公网

`docker compose up -d --build` 启动 API、worker、数据库。rho 不创建 k3s workload。数据库和 Agent 会话分别使用 Compose 数据卷；不挂宿主机 Docker socket。

现有网络链路为 `rho.sh.corgi.plus → tx-pz-v-02 Caddy → Tailscale 100.80.0.189:18870 → rho API`。Caddy 使用独立域名匹配，绕过 9080 的 k3s catch-all。配置片段在 `deploy/rho.caddy`，对应变更同步到相邻 Qortex-Infra 仓库。部署前验证 Caddy 配置并备份原文件，失败恢复原文件。

LiteLLM 沿用上海 GitOps 管理的现有部署，不搬迁服务。经用户授权从现有管理入口创建 `rho-demo` 独立虚拟密钥，初始仅允许 `prod-max-1m`，本轮模型选择功能已按用户要求扩展到全部已配置模型（见下文）。凭据写入 Git 忽略的 `.env`；不将管理密钥交给 rho。

- 运行状态：`docker compose ps`。
- 日志：`docker compose logs --tail=100 api worker`。
- 更新：`docker compose up -d --build`，已运行中的模型任务可能转为中断状态，需要检查后继续。
- 停止：`docker compose down`。日常操作不使用 `down -v`，否则会删除持久数据。
- 更换手机访问令牌：修改 `.env` 的 `RHO_ACCESS_TOKEN` 后重建 API，手机重新填写。
- 更换 LiteLLM 密钥：在 LiteLLM 撤销旧虚拟密钥并生成新密钥，更新 `.env` 后重建 worker。

## 构建与数据保护

`npm run android:build` 使用 `deploy/Dockerfile.android` 中的 Linux 工具链构建签名 release APK，包含 JS 和 MiSans，无需 Metro 常驻。工具链预装 Build Tools 35 与 36，使用增量 prebuild 和 Gradle 缓存，避免每次清空原生构建目录。默认包含 arm64-v8a 与 x86_64，分别用于目标手机和模拟器。字体原文件、官方许可及来源在字体资源目录保留。

`.local/rho-release.keystore` 与 `.local/signing.password` 是持续更新 APK 所需的签名材料，必须与 `.env` 一并保存在用户自己的安全备份中。它们不进入 Git 或 Docker 构建上下文。

备份：`bash scripts/backup.sh`，输出到 `.local/backups/时间戳/`，同时包含数据库、Agent 会话及本机连接和签名材料。备份会短暂停止 API 与 worker，完成后恢复。备份包含私人记录，不上传。

恢复在用户明确需要恢复时执行：停止 API/worker，使用 `pg_restore --clean --if-exists` 恢复数据库；解压 Agent 卷；恢复相同签名材料及 `.env`，再启动服务。恢复旧数据库后，手机需清除本地副本并重新同步，避免旧游标和离线操作与恢复点不一致。不能在未导出手机待提交内容时直接清除应用数据。

## 验证命令

- `npm run typecheck`：三个 workspace 的类型检查。
- `bash scripts/test-server.sh`：独立 `rho_test` 数据库上的行为测试。
- Pi 协议集成测试：在测试数据库运行 `apps/server/test/agent.integration.ts`，使用可控模型协议响应，不冒充真实模型测试。
- `python3 scripts/smoke-live.py`：公网真实模型验证，会创建明确标注的演示记录；中断后用 `--resume` 继续原任务，避免重新提交。

## 参考

[Pi SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md)、[Expo 原生模块](https://docs.expo.dev/modules/get-started/)、[Android 闹钟](https://developer.android.com/develop/background-work/services/alarms)、[LiteLLM 虚拟密钥](https://docs.litellm.ai/docs/proxy/virtual_keys)。

## 模型选择与对话更新（0.3.0）

行为依据：[产品需求：对话界面与模型选择](../product.md#对话界面与模型选择2026-10-08-确认)。

- 手机通过已鉴权的 `GET /v1/models` 实时读取服务端转发的 LiteLLM `/v1/models` 名单；不缓存上游名单，不向手机下发 LiteLLM 凭据。页面进入、手动刷新和保存选择时检查可用性；失败不替换原选择。
- 默认值保存在 PostgreSQL `preferences`，`POST /v1/model-settings` 按版本校验，避免多个客户端互相覆盖。已有对话迁移时固定为部署默认模型；新对话创建时读取偏好。单个对话通过 `conversation.model` 操作更新，沿用事务、版本和操作审计。
- 接收消息时把模型写入 job / message 快照。worker 显式向 Pi SDK 传入任务模型，在同一持久 session 上继续对话；任务恢复保留快照，不追随默认值或会话后续变更。
- 列表表示代理已配置模型，不代表每个模型健康或支持工具。当前适配仍为 OpenAI chat completions 协议，模型调用异常沿用任务失败提示；不伪装成功或自动换模型。
- worker 停止宽限为 210 秒，覆盖现有 180 秒任务超时，部署时先检查任务状态，避免中途强杀。
- rho 的专用 LiteLLM key 使用 `models: ["all-proxy-models"]`，不修改其他 key。管理员一次性运行 `scripts/allow-litellm-models.py`，环境变量提供 `LITELLM_MASTER_KEY`、rho 的 `LITELLM_API_KEY` 和 `LITELLM_BASE_URL`；脚本只输出别名与模型名，凭据不入 Git。权限 API 依据 [LiteLLM Virtual Keys](https://docs.litellm.ai/docs/proxy/virtual_keys)。

对话滚动使用 `onContentSizeChange` 和 `onLayout` 的实际高度计算末尾偏移，在下一帧合并执行；仅用户拖动／惯性滚动改变跟随状态。这样末项间距、输入区和键盘尺寸变化不会沿用旧的近似位置。历史阅读时不主动滚动，待用户点击回到最新。
