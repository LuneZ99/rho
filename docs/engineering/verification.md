# 首个 demo 验证记录

依据：`docs/product.md` 中“第一个 demo（2026-10-04 确认）”及本轮实现变更。实现与检查由 Agent 执行，不代表用户已经验收。检查日期为 2026-10-04。

## 环境与交付

- 服务端：本机 Docker Compose，Node.js 22、PostgreSQL 17、Pi SDK 1.0.2；公网 `https://rho.sh.corgi.plus`，通过现有 Caddy 与 Tailscale 转发。
- 模型：上海现有 LiteLLM 的 `prod-max-1m`；使用经用户授权新建的 `rho-demo` 独立虚拟密钥。
- 手机验证环境：Android 11 / API 30、Google APIs x86_64 模拟器、1080 × 1920、420 dpi。构建另含 arm64-v8a，供索尼 XQ-AT72 安装。
- APK：`artifacts/rho-demo.apk`；校验值：`artifacts/rho-demo.apk.sha256`。JS、字体和原生提醒均随包交付，不依赖 Metro。
- 本机连接资料：`.local/手机连接.txt`，仅含 rho 手机访问令牌，不含 LiteLLM 管理密钥。该文件与签名、备份均不进入 Git。

## 已执行检查

| 检查 | 证据与结果 |
| --- | --- |
| 类型检查 | `npm run typecheck`：mobile、server、shared 通过。 |
| 服务端行为 | `scripts/test-server.sh` 在独立 `rho_test` 数据库执行，10 项通过。覆盖鉴权、任意健康字段、重复提交、版本冲突、忽略与完成、非法提醒时间、消息与任务原子写入、来源会话保留、删除同步、真实 HTTP 进度流，以及公开指南和下载的访问边界。 |
| Pi 协议集成 | `agent.integration.ts` 用可控模型响应验证真实 Pi SDK 调用查询及业务写入工具、落库和最终消息；不是实际模型效果测试。 |
| 真实模型与公网 | `scripts/smoke-live.py` 经公网创建演示咖啡记录、量腰围任务、卡片和提醒。服务重启中断后，通过原任务“检查进度并继续”完成，没有重复记录。 |
| 多对话共享 | 在手机的投资对话中查询另一段对话保存的咖啡记录，正确返回 2 杯，没有新增或修改记录。 |
| 离线队列与后台任务 | 关闭模拟器 Wi-Fi 与移动数据后发消息，跨 APK 更新仍保留；联网后只产生一条用户消息。任务接收后再次断网并离开 App，服务端仍完成投资笔记。 |
| 本地提醒 | 熄屏且无网络时，单次／每天／每周三个提醒均触发，合并为一条通知。本机台账测得该次延迟均为 3 毫秒；重复提醒分别推进一天与一周。 |
| 去重、补发与取消 | 过去的演示提醒补发一次；重新联网、更新 APK、重启后台账没有重复。手机完成测试事项后，三个本地提醒均移除。 |
| 开机恢复 | 实际重启 Android 模拟器；等待开机广播派发后，尚未打开 rho，系统已恢复未来提醒。送达台账仍为原来的 4 条。验证用未来提醒随后取消。 |
| 字体与界面 | 实际安装 release APK，检查三个入口、记录列表、对话、真实软键盘及 1.3 倍系统字体；按钮可达，底部避开三键导航。 |
| 模块无障碍状态 | 最终 APK 的 Android 无障碍树中，健康默认选中；切换投资后健康取消选中、投资选中，切回同样正确。证据为 `.build/accessibility-results.json`。 |
| 安装包检查 | 最终 APK 签名与 SHA-256 核对通过；包内未包含当前服务端密钥或手机访问令牌。 |
| 部署与访问控制 | API、worker、数据库健康；公网健康检查可用，未提供凭据的数据请求返回 401。rho 未创建 k3s workload。 |
| 备份与恢复 | 实际执行 `scripts/backup.sh`；将数据库恢复到临时 `rho_restorecheck`，实体、操作回执、审计数量与原库一致，Agent 归档可读；原库未覆盖。 |
| 服务端依赖审计 | 运行容器中 `npm audit --omit=dev --workspace=@rho/server`：0 项已知漏洞。 |

详细运行日志保存在本机 `.build/`，包含构建、类型检查、行为测试及恢复核对；密钥不写入交付文档。

交付前再次完成备份：`.local/backups/20261004-175446`；备份后 API 与 worker 已恢复运行。

## 界面证据

截图保存在 `artifacts/`：`home-android11.png`、`modules-android11.png`、`chat-android11.png`、`keyboard-android11.png`、`large-font-android11.png` 和 `large-font-actions-android11.png`。大字体时内容自然延长，第二张截图验证滚动后仍可到达底部操作。通知触发测试另有 `notifications-android11.png`；本机提醒台账的时延核对在 `.build/reminder-results.json`。

界面复核结论为 **ship**：唯一要求修复的模块无障碍选中状态已在最终 APK 验证，重新采集的六张截图没有发现回归。该结论限于本轮界面检查，不代表用户验收或索尼真机验收。

## 试用指南补充（0.1.1）

按用户后续要求，增加“连接与提醒 → 试用指南与资料”及公开网页 [试用指南](https://rho.sh.corgi.plus/guide)。内容包含连接说明、六个测试场景、预期结果和验证范围。APK 版本为 0.1.1，versionCode 为 2，可覆盖安装。

- 最终 APK 在 Android 11 模拟器覆盖安装成功，原连接仍保留；断开 Wi-Fi 与移动数据后，目录、连接说明、测试步骤及验证情况均可阅读。
- 1.3 倍字体下滚动遍历六个场景，底部返回按钮可达；系统三键导航与阅读区域分离。验证了 `rho:///guide` 深链接和打开浏览器的按钮。
- Chromium 检查 1280 × 900 与 390 × 844 视口：没有横向溢出、脚本错误；目录与返回链接可用，MiSans 网页字体正常加载。
- 浏览器通过公网按钮下载完整 APK，下载文件、构建产物和公开校验值的 SHA-256 一致；签名通过，包内未包含当前凭据。
- 公开页面不含访问令牌，未鉴权业务接口仍返回 401；任意文件、目录及非 GET／HEAD 访问没有随指南开放。10 项服务端测试和全部类型检查通过。

截图：`artifacts/guide-settings-android11.png`、`guide-index-android11.png`、`guide-steps-android11.png`、`guide-large-font-android11.png`、`guide-actions-android11.png`。运行证据：`.build/guide-native-results.json`、`.build/guide-web-results.json`、`.build/guide-server-test.log`。网页截图在 `.impeccable/review/guide-*.png`。

本次指南界面复核结论为 **ship**，未提出待修复项；范围限于上述 Android 模拟器和网页视口。

## 设备验证边界

索尼 XQ-AT72 真机尚未连接。五分钟锁屏提醒目标、厂商省电策略、长期内存与耗电、移动网络切换、字体长时间阅读体验仍需在目标手机上验收。模拟器的通过结果不能替代这些真机检查。

测试尝试强制深度 Doze 时，系统因即将到来的可见闹钟停在 INACTIVE；本轮只确认了实际熄屏断网触发，不将它描述为已通过深度 Doze 压力测试。

系统强制停止应用或关机期间不能保证触发；重新打开／开机后恢复并补发。系统通知关闭时界面显示尚未安排状态。产品的提醒目标没有降低。

## 尚未包含的产品方向

本轮不包含记账、手环、健康图表与自动计划、动态专属功能、自适应学习、安装工具、SSH 或远程开发，范围与确认的 demo 一致。没有应用商店发布。Git 提交与同步按 `AGENTS.md` 中的约定执行，不代表用户验收或应用商店发布。

## 蓝色主题与发布页（2026-10-08）

依据：[产品需求的本轮变更](../product.md#外观与发布版本2026-10-08-确认)。显示版本 `0.2.0-test.261008.1`，Android 安装编号 3，包含 arm64-v8a 与 x86_64。首个 demo 的其余验收结论沿用原记录，不将本次界面检查扩展为全产品重新验收。

- 全部 workspace 与发布脚本类型检查通过；独立测试数据库上的 11 项服务端测试通过。发布接口另检查了空列表、降序排列、新旧包下载、HEAD、缺包、大小不符、未鉴权业务接口和非法文件访问。
- 在原 Android 11 / API 30 模拟器从 0.1.1 覆盖安装成功，断网下模块页记录文本逐项一致，原服务地址和已保存连接仍保留。
- 使用真实发布服务，设置入口、当前安装版本、历史卡片以及新旧两个下载地址均已验证。首次 Chrome 初始化与 App 下载分开处理；由系统浏览器接管下载和安装。
- 断网显示可重试错误，恢复网络后刷新成功；刷新未清空本次已加载的内容。
- 1.3 倍系统字体下滚动后仍能点击旧版下载卡片，未发现文字裁切或系统导航遮挡。普通字号与大字体截图已随 Git 保存：[发布页](screenshots/releases-android11.png)、[大字体](screenshots/releases-large-font-android11.png)。
- 两个公网安装包完整下载后的大小和 SHA-256 与发布清单一致。新旧 APK 签名指纹相同，归档时均经 apksigner 验证；新版包内未包含当前服务令牌、模型密钥或数据库密码。
- 公开下载 API 已更新，公网健康检查正常，业务接口无凭据仍返回 401。worker 未因发布页更新而重建。

本轮仍未连接索尼 XQ-AT72 真机，模拟器检查不代表用户验收。旧版可下载不代表 Android 允许降级覆盖，页面已说明本地数据边界。

本轮原生自动验证脚本：`python3 scripts/verify-release-android.py`，依赖已启动的模拟器容器和已完成首次初始化的 Chrome。结果存于 `.build/blue-native-results.json`，覆盖安装核对在 `.build/blue-update-results.json`；构建日志、11 项服务端测试日志与原图在构建机的 `.build/` 和 `artifacts/`。

跨机器恢复实测：在当前开发工作区的空 `.build/restore-from-git/` 目录执行 `scripts/restore-releases.mts`，只使用 Git 发布清单和 GitHub Releases，成功恢复 0.1.1、新测试版及 `rho-demo.apk` 最新兼容入口；逐个 SHA-256 一致，不依赖旧机器私钥或旧目录。GitHub 资产服务端摘要也与清单一致。

## 网页历史版本列表（2026-10-08）

现有主页与 `/guide` 在指南前新增发布版本列表，分享入口为 `https://rho.sh.corgi.plus/#releases`；使用与 App 相同的实时清单，本次无需更新 APK。

- 类型检查、独立数据库 11 项服务端测试通过；覆盖网页空列表、两版链接与顺序、说明 HTML 转义及清单损坏后仍保留指南。
- Chromium 在 1280×900 和 390×844 检查：无横向溢出、无页面脚本错误；版本锚点和校验值展开正常。手机宽度下点击两个下载按钮，实际下载 APK 后核对大小和 SHA-256，均与清单一致。
- 本地浏览器证据为 `.build/release-web-results.json`、`.impeccable/review/release-web-desktop.png` 与 `release-web-mobile.png`；可用仓库内 `scripts/verify-release-web.py` 重现。
- 独立界面复核结论为 **ship**，限本次网页扩展；保留原蓝色、MiSans 和指南。检测器两项既有圆角单位 advisory 不构成此次设计变更，不需修改 `DESIGN.md`。

尚未验证真实手机浏览器的系统安装流程，本次不代表用户验收。

## Telegram 风格对话与模型选择（2026-10-08）

依据：[本轮产品要求](../product.md#对话界面与模型选择2026-10-08-确认)。保留原深蓝主题与 MiSans，新增左右气泡、日期与时间、输入框旁发送、历史阅读与回到最新，以及默认／单对话模型设置。

- `npm run typecheck` 通过。独立 `rho_test` 数据库的 12 项后端测试通过，覆盖实时目录变化、鉴权、默认值范围、单对话设置、版本冲突、失效模型、上游故障与任务模型快照。
- 真实 Pi SDK 配合可控 OpenAI 协议服务，验证两个模型连续调用、工具执行与对话上下文保持；此项不代表真实供应商可用性。
- 部署后通过真实 LiteLLM，测试对话从 `prod-max-1m` 切换到 `gpt-6.1-sol-medium`，第二轮正确复述第一轮代号，任务均 completed。实测的是这两个模型，不将目录中的全部模型称为逐个验收。
- 专用 rho key 已开放所有已配置代理模型，实时 `/v1/models` 返回 20 个，和管理员看到的配置名单一致。手机只收到模型名与已选设置；凭据留在服务端。
- Android 11 / API 30、1080×1920、420 dpi 模拟器，首轮 APK 已检查默认模型保存与恢复、独立会话模型保存、搜索及空结果、键盘下发送控件可达、断网错误及联网刷新、1.3 倍字体。覆盖安装保留原连接及聊天记录。
- 首轮发现长对话首次打开定位不完整，随后修正：只有用户滚动才改变跟随状态，布局变化不取消跟随；单对话模型刷新同时同步最新会话设置。最终采用内容与视口的实际高度计算偏移，不依赖 FlatList 的近似末项位置。

可重复运行的检查：`scripts/test-server.sh`、`apps/server/test/agent.integration.ts`、`scripts/verify-model-live.py`、`scripts/verify-chat-android.py`、`scripts/verify-chat-scroll.py`（需要 Pillow）。运行日志保存在部署机 `.build/chat-*.log`；公开截图保存在 `artifacts/chat-android11/`。索尼 XQ-AT72 真机尚未验证，以上不代表用户验收；Play Protect 提示按用户要求保持现状。

最终包 `0.3.0-test.261008.3`（Android versionCode 6）重新覆盖安装成功，保留同一签名、连接与历史。真实流式回复测试生成 200 行测试文本：用户滚动到旧消息后，生成前后同一消息区域的像素 SHA-256 完全一致，保持阅读位置；回到最新后末条正文、时间与气泡下沿完整显示，键盘开关、冷启动与 1.3 倍字体也保持末尾。测试任务 `1276de66-a8cd-4a40-b532-246024448cc0` completed；没有请求创建业务记录。

验证工具曾在流式更新时无法取得 UiAutomator idle，误读旧 XML 造成坐标断言失败；保留当时前后截图，改为像素位置比较并继续验证，不重复发送测试消息。大字体导航栏先前截图处在字体重建／深链导航的过渡状态；改由正常设置入口进入并等待稳定，标题与返回完整，系统返回实测回到设置。

截图：[对话](screenshots/chat-models-android11.png)、[键盘下最新回复](screenshots/chat-keyboard-android11.png)、[历史阅读中](screenshots/chat-history-streaming-android11.png)、[回复完成后同一位置](screenshots/chat-history-completed-android11.png)、[模型列表](screenshots/models-android11.png)、[大字体模型页](screenshots/models-large-font-android11.png)。

独立界面复核的 3 项修复评分均为 resolved，disposition 为 **ship**；结论限这三项，不扩展为全产品或真机验收。最终 APK 的公开下载 SHA-256 为 `fd8f24c27462bba13fc53d2f4462dcd2d91afefaf626f5f212acb83afc800751`，与归档清单一致，签名和早期版本一致。网页与 App 发布目录共含 5 个实际留存版本，最终版可从两处下载。

跨机器恢复复验：从 GitHub 下载最终版，在隔离目录运行 `releases:restore`，校验五个版本并恢复最新下载别名，SHA 与清单一致。当前默认模型仍为 `prod-max-1m`，验证期间的临时默认值已经恢复。
