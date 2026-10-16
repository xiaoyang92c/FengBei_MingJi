# 墙面与通行界面 v22

2026-10-15。本轮按最新反馈把墙面从密集小块、深黑砖缝改成中等尺度的平整料石，砖缝有深浅，减轻锐化。桌面材质以两段共享边缘的连续显示控制采样倍率，手机按原比例显示；不会把整张低分辨率图横向拉伸到三个全屏。横向墙面两端多留 55vw，缩短门距后拖到尽头仍有材质覆盖。

- PC 门中心的逻辑步长由 100vw 调到 62vw，手机仍是 132vw。相同镜头倍率下桌面实际中心距离约 0.78 个视口。
- 先做 1.18 的对比曲线，再用 1.08 的 gamma 增益和 0.9 指数提亮中间调与亮部；暗部保留层次。标题区域采用场景内的顶部遮光，使浅色文字有可读的背景。
- 入口和声音按钮使用浅象牙色与暖黑字，移除新加的绿色文字与绿色票面。票面保留章节编号和虚线分栏；声音用声波与开关状态表达，开关不再重新渲染整个页面。
- 标题下的叙事小字已从选章页删除。仅保留章节标签和主标题。
- 切换动画到 86% 时开始显示标题，比原先提前约 150ms；按 0.58 秒曲线逐字显现，字间延迟 50ms，四字标题整组约 0.73 秒完成。常态以 5.8 秒错拍的 1–2px 浮动持续呼吸。减少动态效果会停用这些动效。
- 入口票面使用独立的 0.52 秒淡入、上移 10px 动效，与按钮悬浮反馈互不覆盖。移动端入口上移约 40px，为底部声音控件留出间距，并考虑安全区域。
- 左右箭头的实际圆面缩到约 38–40px，点击区域仍为 44px。

## 墙面资源

内置 imagegen 编辑生成。项目文件：`public/assets/scenes/portal-wall-balanced-v22.webp`，2172×724；只做 WebP 编码，不裁切或放大。

原图：`C:/Users/pc/.codex/generated_images/01a12f02-05d1-7162-a075-5e0e8f428402/exec-39b350b7-057b-468c-9378-a658ea7cc92d.png`。

最终提示词：

> Edit this masonry texture for a subtle realistic architectural wall. The current stones are too small and the mortar grooves are too dark and deep. Replace the layout with MEDIUM-SIZED rectangular dressed limestone blocks: approximately 26 blocks across the entire wide canvas and 14 to 16 horizontal courses from top to bottom. The block faces are flat pale ivory-gray with understated fine weathering and occasional small chips. Joints are narrow and pale gray, with irregular subtle depth: some almost flush, some modestly recessed, never uniformly outlined in black. Keep restrained realistic contact shadows only at selected edges. Match a luminous photographed limestone facade in clear daylight, gently overexposed highlights and high clarity without heavy gritty texture. The material should feel calm and real, not a medieval cobblestone wall and not a cartoon brick pattern. Full-bleed uninterrupted 3:1 panoramic stone surface, every pixel wall, clean continuous horizontal courses. Neutral lighting across the entire image; no baked tree shadows, no vignette, no doors or windows, no floor, no sky, no text.

## 验证

构建使用 `npm run build`。浏览器核对桌面和手机布局、章节切换、声音的开关反馈，以及新票面入口与退出流程。读回 DOM 检查标题副文本已移除、文字入场为 0.58 秒、票面入场为 0.52 秒、常态动效为 glyph-breathe，CSS 与脚本的章节步长保持一致。
