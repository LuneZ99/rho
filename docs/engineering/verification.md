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
