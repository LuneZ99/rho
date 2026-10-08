# rho 本地设计 skills

安装位置为项目内 `.agents/skills/`，供开发 Agent 按需读取；不是 rho App 的运行依赖。安装采用 skill-installer 的 Git 模式并固定上游提交，未安装全局插件或自动编辑 hooks。

## 使用顺序

先读 [协作约定](../../AGENTS.md)、[产品需求](../../docs/product.md) 和 [设计约定](../../DESIGN.md)，再按任务读取相应 `SKILL.md`。

| Skill | 用途 |
| --- | --- |
| [expo-design-system](expo-design-system/SKILL.md) | 统一字体、颜色、间距、组件与界面状态的表达 |
| [expo-native-ui](expo-native-ui/SKILL.md) | 原生界面布局、控件和交互检查 |
| [expo-ui](expo-ui/SKILL.md) | 配套原生控件指导 |
| [expo-router](expo-router/SKILL.md) | 页面导航、标签页与弹层 |
| [expo-animation](expo-animation/SKILL.md) | 手势、键盘及动效 |
| [expo-data-fetching](expo-data-fetching/SKILL.md) | 加载、保存、失败、离线等数据状态 |
| [expo-project-structure](expo-project-structure/SKILL.md) | 主题与可复用组件的文件组织 |
| [impeccable](impeccable/SKILL.md) | 视觉层级、排版、文案与交互评审和打磨 |

Expo 后五项是设计指导引用的配套能力，按实际任务加载，不必每次读取全部文件。可选反馈、部署及其他未引入的 skill 并非本次安装内容。

Impeccable 同时包含 Android 和原生评审参考。其浏览器实时预览能力适用于 Web；Android 结果仍需原生预览或真机验证。启动器会使用本地引擎，缺少时下载指定版本并校验摘要；本次只安装 skill 及验证引擎，不执行产品初始化或生成界面。

## 来源与版本

引入日期：2026-10-04。上游 skill 正文、参考文件和脚本保留原样；补充许可证和版权说明。

- [expo/skills](https://github.com/expo/skills/tree/13ad8e05874195633b5c185f6947bb6400e228fc)：提交 `13ad8e05874195633b5c185f6947bb6400e228fc`，目录 `plugins/expo/skills/<skill-name>`。采用 MIT 许可证，各目录保留 `LICENSE`。
- [pbakaus/impeccable](https://github.com/pbakaus/impeccable/tree/e103efe779e2dd01274dabae83531fef00bf2563)：提交 `e103efe779e2dd01274dabae83531fef00bf2563`，目录 `.agents/skills/impeccable`。Skill 版本 4.5.0，引擎版本由 `scripts/VERSION` 固定为 0.1.11；保留上游 `LICENSE` 与 `NOTICE.md`。

后续更新时先比较上游变更，再更换对应目录、复核本地适配约定并更新这里的提交号。不要自动追随上游最新版本。

## 本次检查

- 8 个 skill 的名称与 YAML 元数据解析通过。
- 100 个上游文件逐一与固定提交的 Git 对象摘要比对一致。
- Impeccable 启动器语法检查通过，运行 `engine-probe` 返回 `impeccable-engine 0.1.11`。
- 尚无 App 界面，未进行界面生成或视觉验收。
