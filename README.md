# 丰碑与铭记

> 先有锤声，才有火车声。
> 路修好了，别忘了修路的人。

**[📺 打开电视，走进这段记忆](https://fengbeimingji.vercel.app/)** · [查看源码](https://github.com/xiaoyang92c/FengBei_MingJi)

三处空间，五条线索，大约三到五分钟。

这是一段可以亲手翻阅的铁路记忆：从老电视里出发，穿过一扇窗，听见凿石和落锤；等火车驶过，再走到碑前，读一遍“筑路民工”。

项目围绕成渝铁路建设与筑路民工纪念碑展开，是“成渝铁路工业遗产数字记忆馆”的第二章。**手机竖屏是主要体验方式，电脑横屏也可以完整游览。**

## 这几分钟，你会做什么？

1. **给电视开机。** 选择有声或静音，再点一次确认进入。
2. **选一扇窗。** 左右滑动，找到想去的记忆空间，穿过窗口。
3. **找一条线索。** 点开场景中的编号，看看工具、日期和碑文背后的故事。
4. **翻翻记忆册。** 看照片、读现场手记，让年表从开工走到通车，再走到奠基。
5. **回到碑前。** 收齐五条线索后，读终章，让电视为这段记忆收尾。

“再看一次”会保留收录，“重新开始”会清空收录。进度记在当前浏览器里，无需注册，也不会跨设备同步。

## 三扇窗，分别通向哪里？

| 开山筑路 | 铁路贯通 | 回到碑前 |
| :---: | :---: | :---: |
| ![背对镜头的筑路者在山间铺轨](public/assets/scenes/worksite-wide-v43.webp) | ![居中的蒸汽列车与站台](public/assets/scenes/opening-wide-v43.webp) | ![树林中的筑路民工纪念碑](public/assets/scenes/memorial-wide-v43.webp) |
| 01 钢钎与大锤 · 02 一起修路 | 03 全线通车 | 04 碑上的字 · 05 通车之后 |
| 凿石声、人群声 | 火车声、人群声 | 清晨与林间自然声 |

**这里的写实场景是生成图，不是历史现场照片。** 碑体形制参考实碑照片与地方资料，史料来源另有记录。

## 有些细节，适合慢一点看

- 电视会从一条亮线里醒来，终章也会回到同一块屏幕。
- 窗口和场景沿着同一条镜头路径进出；手机端提前准备画面，用固定图层衔接。
- 记忆册和手记像纸页一样折开。手机采用单独绘制正反面的折页，避免嵌套 3D 翻面。
- 年表按 **1950 → 1952 → 1954** 循环：旧记事逐字离开，新记事逐字出现。
- 锤声、火车声和“路修好了”也有各自的文字节奏。
- 背景音乐与环境声分层播放，进入场景后，音乐会让出一些音量。

### 手机上怎么用体感？

体感开关就在声音开关左边，**默认是“关”**。点一下，按浏览器提示允许“动作与方向”访问；收到有效传感器数据后才显示“开”。再点一次即可关闭。

轻轻倾斜手机，就能环顾场景。偏移有缓动和边界限制；进入新场景时会重新校准自然握姿。未授权、未连接和不支持时，都不会假装已经开启。

电脑使用鼠标视差。系统开启“减少动态效果”时，会停用体感并简化动效。`Esc` 可以关闭线索页、记忆册或手记。

## 想在本地跑起来？

准备 **Node.js 20.19+ 或 22.12+**，然后：

```bash
git clone https://github.com/xiaoyang92c/FengBei_MingJi.git
cd FengBei_MingJi
npm ci
npm run dev
```

打开终端给出的地址，默认是 `http://localhost:5173/`。

```bash
npm run build       # 类型检查 + 构建，输出到 dist/
npm run preview     # 预览构建结果，默认端口 4173
```

手机和电脑在同一网络时，可以用电脑的局域网地址调试布局与触摸。**体感需要 HTTPS**，普通 HTTP 局域网地址不能完整验证；可以在 [Vercel 在线版](https://fengbeimingji.vercel.app/) 测试授权与倾斜操作。

## 代码放在哪里？

项目名称是 `FengBei_MingJi`。本地直接打开 `E:\A-Codex\FengBei_MingJi`，源码就在根目录。

```text
FengBei_MingJi/
├─ src/                  # 交互、界面、声音与动效
│  ├─ main.ts            # 路由、镜头与空间切换
│  ├─ content.ts         # 三处空间与五条线索
│  ├─ device-tilt.ts     # 体感授权、校准和缓动
│  ├─ portal-flight.ts   # 穿梭几何与画面投影
│  ├─ paper-fold.ts      # 记忆册、手记共用的折页
│  ├─ background-music.ts # 流式背景音乐与增益控制
│  └─ ...                # 电视、资料页、记忆册及各自样式
├─ public/assets/        # 场景、声音与素材清单
├─ docs/                 # 设计过程、史料与实现记录
├─ scripts/              # 素材处理和回归检查
├─ output/imagegen/      # 生成原图与提示词
└─ README.md
```

实现使用 **TypeScript、Vite、GSAP**；Three.js 主要用于数学计算，声音使用 Web Audio 与流式媒体。当前场景由图片与 DOM 构成，不加载历史 GLB 模型，也没有人物视频入口。

横屏与竖屏使用各自的场景构图，线索点随取景定位。本地进度的存储键是 `fengbei-memory-v2`。

## 发布与检查

在线版部署在 **Vercel**：<https://fengbeimingji.vercel.app/>。

构建命令为 `npm run build`，静态输出目录为 `dist`。项目按站点根目录加载 `/assets/…` 资源；如果部署到仓库子路径，需要同步调整资源路径。`node_modules/` 和 `dist/` 不提交到 GitHub。

```bash
npm run build
node scripts/check-device-tilt.mjs
node scripts/check-mobile-runtime.mjs
node scripts/check-transitions.mjs
```

检查覆盖体感默认状态与授权、音频恢复、加载数字居中、穿梭画面覆盖、折页面切换和清理。**这些检查不替代真机体验**：微信、夸克等浏览器的实际绘制、声音中断和后台恢复，仍需要手机确认。

## 素材从哪里来？

- 场景由 imagegen 生成，手机图为 1254×1254，桌面横图为 1672×941，运行时使用 WebP。
- 画面上的日期是叙事事件时间，不表示图片拍摄日期。
- 声音由用户提供，长背景音乐另有较小的 AAC 流式版本。复用素材前，请确认各自授权范围。
- 中文字体使用 Noto Sans SC、Noto Serif SC，并提供系统字体回退；加载数字使用桌面字体的矢量轮廓。

继续往里看：[史料来源](docs/sources.csv) · [资源清单](public/assets/asset-manifest.json) · [场景构图](docs/scenes-v42.md) · [生成提示词](output/imagegen/scenes-v42/prompts.json) · [横竖屏适配](docs/responsive-scenes-v43.md) · [移动端兼容调整](docs/mobile-compatibility-v47.md)

目前“返回记忆馆”和“进入下一章”的外部地址尚未接入。
