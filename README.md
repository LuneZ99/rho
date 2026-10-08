# rho

个人 Android 助手，第一个 demo：对话记录健康、投资想法和待办，用首页卡片处理事项，并在手机本地提醒。

- [产品需求](docs/product.md)：产品范围与本轮确认行为。
- [设计约定](DESIGN.md)：深色界面与 MiSans。
- [技术与运行说明](docs/engineering/demo.md)：部署、构建、接口及恢复。
- [验证记录](docs/engineering/verification.md)：实际验证环境与待验证项目。

## 本机运行

需要 Node.js 22.19+ 和 Docker Compose。复制 `.env.example` 为 `.env`，生成独立数据库密码和访问令牌，配置 LiteLLM 调用密钥。不要提交 `.env`。

```sh
npm ci
docker compose up -d --build
npm run typecheck
bash scripts/test-server.sh
```

Android 构建：`npm run android:build`。产物为 `artifacts/rho-demo.apk`；首次构建会下载 Android 工具链。签名材料保存在 `.local/`，后续更新必须保留。

手机安装后进入“连接与提醒”，填写服务地址和 rho 访问令牌。LiteLLM 密钥只配置到服务端，不填入手机。

## 本轮试用

手机可直接打开 [试用指南](https://rho.sh.corgi.plus/guide)，下载新版 APK、查看连接资料、测试步骤及验证范围。安装后也可从“连接与提醒 → 试用指南与资料”阅读，App 内指南支持离线查看。

首次连接，在“连接与提醒”填写 `https://rho.sh.corgi.plus` 与本机 `.local/手机连接.txt` 中的访问令牌，再点击“验证并保存连接”。保持手机通知开启。公开指南不包含令牌；已安装旧版本时直接覆盖安装，保留连接和本地记录。

带“演示”或“验证”字样的内容是开发检查创建的数据，不代表你的真实生活记录。目标索尼手机仍需按[验证记录](docs/engineering/verification.md)检查锁屏提醒与实际体验。
