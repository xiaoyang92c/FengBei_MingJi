# 丰碑与铭记

> 先有锤声，才有火车声。路修好了，别忘了修路的人。

**[在线体验](https://fengbeimingji.vercel.app/)** · [项目源码](https://github.com/xiaoyang92c/FengBei_MingJi)

一段可以走进去、亲手翻阅的成渝铁路记忆。从老电视出发，穿过三扇窗，寻找五条线索，听筑路的声音，再到纪念碑前记住修路的人。

## 怎么玩

- **开山筑路**：看看钢钎、大锤和一起修路的人。
- **铁路贯通**：听火车驶来，读开工与通车的日期。
- **回到碑前**：读碑文，把修路的人记下来。

点击场景编号收录线索，随时打开现场手记和记忆册；收齐后可读终章。约需 3–5 分钟，推荐手机竖屏、有声体验，电脑也可游览。手机可手动开启体感，电脑使用鼠标偏移。

进度保存在当前浏览器。“再看一次”保留收录，“重新开始”清空收录。

## 本地运行

需要 Node.js 20.19+ 或 22.12+。

```bash
git clone https://github.com/xiaoyang92c/FengBei_MingJi.git
cd FengBei_MingJi
npm ci
npm run dev
```

```bash
npm run build     # 类型检查与构建，输出 dist/
npm run preview   # 预览构建结果
```

使用 TypeScript、Vite、GSAP 与 Three.js 数学计算，部署于 Vercel。体感需在 HTTPS 下授权使用。

## 素材与资料

写实场景为 AI 生成图，非历史现场照片；画面日期为叙事事件时间。声音由用户提供，复用素材前请确认授权。

[史料来源](docs/sources.csv) · [资源清单](public/assets/asset-manifest.json)
