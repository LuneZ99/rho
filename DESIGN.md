---
name: rho
description: 深蓝底色、MiSans 与舒展卡片组成的 Android 日常记录界面
colors:
  background: "#101823"
  surface: "#1A2738"
  raised: "#25364D"
  text: "#EDF3FC"
  muted: "#ADBDD3"
  accent: "#A6C8FF"
  onAccent: "#132F54"
  line: "#354861"
  error: "#FFB4AB"
typography:
  title:
    fontFamily: MiSansMedium
    fontSize: "20sp"
    lineHeight: "29sp"
  body:
    fontFamily: MiSans
    fontSize: "16sp"
    lineHeight: "25sp"
  label:
    fontFamily: MiSans
    fontSize: "13sp"
    lineHeight: "25sp"
  tab:
    fontFamily: MiSansMedium
    fontSize: "12sp"
rounded:
  control: "12dp"
  panel: "16dp"
spacing:
  xs: "4dp"
  sm: "8dp"
  md: "16dp"
  page: "20dp"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.onAccent}"
    rounded: "{rounded.control}"
    padding: "11dp 16dp"
  button-secondary:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "11dp 16dp"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.page}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "14dp"
---

# rho 设计约定

## Overview

**Creative North Star: "让日常值得关注的事清楚可见"**

深色蓝调界面，以 MiSans 和舒展卡片承载日常记录与可执行操作。保持 Android 原生导航和操作习惯；本轮不加入装饰动画。首页突出关注事项，模块历史采用列表，产品行为以 [产品需求](docs/product.md) 为准。

状态：首个 demo 已实现，MiSans 已随 APK 接入；Android 11 / API 30 模拟器已检查界面、软键盘、1.3 倍系统字体与模块选中状态。索尼 XQ-AT72 真机尚未验证，不代表用户验收。截图、安装包及验证边界见 [验证记录](docs/engineering/verification.md)。

**Key Characteristics:**

- 深蓝背景、浅蓝操作强调、明亮正文。
- 同一字体家族，以字号、字重和留白区分层级。
- 卡片舒展、历史列表清楚，操作随大字体自然换行。

## Colors

颜色取自 [主题](apps/mobile/src/theme.ts)，以深浅表面组织内容。

### Primary

- `accent`：主按钮、已选模块与底部当前入口；`onAccent` 用于主按钮文字。

### Neutral

- `background`：页面与导航底色；`surface`：卡片和输入框；`raised`：次按钮和用户消息。
- `text`：正文与标题；`muted`：日期、说明和元信息；`line`：输入框描边与列表、导航分隔。
- `error`：错误与失败提示。

**The 状态可辨 Rule.** 选中模块同时使用主按钮配色与原生无障碍选中状态，不能只靠颜色表达。

## Typography

正文、标题、按钮及数值统一使用 **MiSans（小米字体）**。正文用 Regular，按钮、标题和底部入口用 Medium；主题分别映射为 `MiSans`、`MiSansMedium`，页面复用统一组件。

前置令牌记录 React Native 数值对应的 Android 字号单位（sp）与布局单位（dp），不是 CSS。字号随系统字体设置缩放；原生导航标题采用导航组件字号，不编造额外展示字号。

- `title`：页面强调句与卡片、记录标题。
- `body`：主要内容与按钮文字；按钮使用 Medium。
- `label`：时间、模块、消息身份和处理状态；辅助正文仍可使用 `body`。
- `tab`：底部三个入口标签。

**The 单一字体 Rule.** 保持同一字体家族，不默认搭配衬线装饰字体，不用细字重承载主要内容。

字体来源：[MiSans 官方介绍](https://hyperos.mi.com/font/zh/about/)与[官方下载](https://hyperos.mi.com/font/zh/download/)。已引入官方 Regular、Medium 原始静态文件，经 expo-font 加载，字体随安装包离线提供；来源与官方许可保留在 [字体目录](apps/mobile/assets/fonts/README.md)。加载失败或缺少字形时按原约定使用系统无衬线回退；回退表现尚未单独验证。

目标手机上仍需检查安装包、首屏加载、内存影响，以及中文标点、英文、金额、日期混排与长段对话的实际阅读效果。

## Layout

页面左右留白使用 `page`，卡片间距使用 `md`；卡片内边距使用 `page`，内部主要内容间距使用 `md`。主列表底部保留额外空间，操作行允许换行，不通过固定文字高度限制系统字体放大。

顶部使用原生导航标题，底部为首页／对话／模块；连接设置与发布版本是独立页面。发布版本使用整张可点击卡片，展示版本、发布类型、日期、大小、更新说明和下载操作。底栏按底部安全区和系统字体倍率增加高度。对话输入区避开软键盘与系统导航区域。

首屏优先显示本地缓存，后台刷新失败不清空已保存内容；具体状态与交互遵循产品文档。大字体时允许页面延长并滚动到操作，不要求所有内容挤在首屏。

## Elevation & Depth

当前共享组件不使用阴影；依靠背景、卡片、次按钮和消息表面的色阶分层。输入框与列表使用细线表达边界，不添加悬浮装饰或玻璃效果。

## Shapes

卡片与用户消息采用 `panel` 圆角，按钮与输入框采用 `control` 圆角。卡片保持宽松、稳定的矩形轮廓；模块历史用分隔列表，不强制套卡片。

## Components

实现依据：[共享组件](apps/mobile/src/components/ui.tsx) 与各页面；侧车仅记录原生组件元信息，不生成虚构的 Web 组件。

### Buttons

主次按钮复用同一组件，最小高度 48dp；这是最低触控要求，允许内容撑高。按下或禁用时透明度为 0.55，加载时显示活动指示器并停用点击。模块选择复用主次按钮样式，并传递 `accessibilityState.selected`。

### Cards / Containers

卡片使用 `panel` 令牌，内部依次组织事实、说明与操作；没有额外阴影。卡片中的模块名是内容来源信息，不扩展为各页面的装饰小标题。

### Inputs / Fields

输入框最小高度 52dp、1dp 分隔色描边；占位文字使用辅助色，文字选择使用强调色。对话输入支持多行、最大高度 160dp；聚焦采用 Android 原生输入行为，未实现额外焦点光晕。

### Navigation

底部图标配文字标签，当前入口用强调色，其余用辅助色。使用已有 MaterialIcons 资源，不把字符拼成图标。原生导航过渡与活动指示器属于功能反馈，不加入装饰动画。

### Lists / Messages

记录列表用细分隔线、标题、摘要与时间说明；摘要可截为两行，详情承载完整内容。用户消息靠右、最大宽度 92%，使用抬高色表面；rho 回复靠左、最大宽度 92%，使用 surface 表面。日期居中分隔，气泡内显示时间；发送按钮在多行输入框旁。阅读历史时保留位置，并提供回到最新操作。错误和待同步状态用文字解释，不只改变颜色。

模型选择使用可搜索的长列表，选中项同时显示单选图标和无障碍选中状态；底部保存操作明确区分新对话默认值和此对话模型。

## Do's and Don'ts

### Do:

- **Do** 复用主题和共享组件，保留深蓝底色、MiSans 与舒展卡片。
- **Do** 保持操作触控区域至少 48dp，并检查大字体、长内容和键盘下的操作可达性。
- **Do** 在目标 Android 手机上验证中文、英文、金额、日期和长段内容；模拟器通过不代替真机验收。

### Don't:

- **Don't** 擅自更换已确认字体、改为紧凑卡片或改变产品行为。
- **Don't** 添加装饰动画、装饰字体或无内容意义的小标题。
- **Don't** 用固定高度裁切主要文字，或把截断摘要当成完整详情。
