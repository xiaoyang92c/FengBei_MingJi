# 连续光影与镜头质感 v20

2026-10-15。外墙仍是完整的一张长图，三扇门在同一坐标系内移动。

- 墙面采用新的小块料石图，砖缝更深、石面更平整，统一使用 cover；手机端按高度等比显示，保持石块比例。
- 树影仅使用一份透明投影，跨第一章延伸到第二章左侧，在世界坐标中逐渐减弱。第三章使用单独的建筑斜角投影。阴影位于门框后面的墙面层。
- 树影不作往返横向平移：两层同源投影以不同周期轻微改变 X/Y 轴角度、旋转和缩放，形成枝叶的细碎颤动，边缘做局部柔化。
- 公共 camera-rig 用不共周期的正弦产生约 1–2 px 的持续呼吸运动。窗口、穿梭层和室内全部位于同一个 rig。测量门洞时先转换回 rig 内坐标，避免轻晃被计算两次。
- 公共 SVG 径向位移图让墙砖线条在画面边缘轻微弯曲，构成实际的桶形镜头畸变。中心变化最小，位移在画幅最外沿回落为零，避免采样到图片外部而露底。滤镜没有模糊步骤。
- 固定镜头暗角覆盖所有空间；UI 不受桶形畸变影响。细颗粒约每 55 ms 更新一次，灰度图以 0.13 的 soft-light 强度混合，附加极弱扫描纹。
- 减少动态效果会停用呼吸、树影颤动、颗粒和径向畸变。

## 资源和生成方式

使用内置 imagegen。输出保留在 Codex generated_images，项目中以 WebP 使用，仅进行格式编码，无缩放和裁切。

最终墙面：`public/assets/scenes/portal-wall-relief-v20.webp`，2172×724。
生成原图：`C:/Users/pc/.codex/generated_images/01a12f02-05d1-7162-a075-5e0e8f428402/exec-13a4aa05-737f-48c2-baee-e45d8dd29ecd.png`。

最终提示词：

> Edit this full-bleed wall texture. The stones are too large and too rounded. Replace them with MUCH SMALLER rectangular dressed limestone masonry, approximately 55 stone blocks across the entire wide image and 30 horizontal courses from top to bottom. Keep a single uninterrupted 3:1 panorama, wall covering every pixel with no margins. Stone faces should be mostly flat and finely weathered warm gray ivory, as on an early twentieth-century Chinese railway station or industrial heritage building. Make the mortar joints thin but distinctly deep and recessed, with believable subtle contact shadows and beveled chipped edges. Far less pitted than the reference; no cobblestones, no rounded lumpy rocks, no heavy scribble cracks, no cartoon outlines. Texture should feel tactile and real under neutral soft daylight. No tree shadows, no architectural shadows, no doors, no windows, no floor or sky, no text. Uniform exposure across the entire continuous wall.

最终树影：`public/assets/scenes/foliage-projection-v19.webp`，保留透明通道。
生成原图：`C:/Users/pc/.codex/generated_images/01a12f02-05d1-7162-a075-5e0e8f428402/exec-ac67133b-a9d1-41c7-b6db-10dc1cb3e218.png`。

最终提示词：

> Asset type: transparent projected shadow overlay for a photoreal heritage museum website. Create a wide 3:1 image containing ONLY soft dark neutral gray cast shadows of leafy tree branches, with a genuinely transparent background. Shadows appear like sunlight filtered through a real tree onto a wall: irregular interlocking small leaf clusters, thin branching twigs, overlapping natural penumbrae, some leaves nearer and sharper, most softly defocused. Shadow mass enters from upper left and left edge, flows diagonally toward lower center and becomes sparse and fades to fully transparent by the rightmost quarter. Keep many clear sunlit gaps. The tree itself is never visible, only its softly projected silhouette. No wall, no white background, no canvas texture, no leaf veins, no painted foliage, no frame, no objects, no text. Natural diffuse shadows, understated photographic realism rather than solid graphic leaf cutouts.

## 验证

`npm run build`。本地浏览器核对 1440×900 三章光影和 390×844 手机比例，进入、退出时指针仍影响镜头；读取穿梭层与室内层的矩阵确认两者一致。两次间隔观察确认静止指针时公共 rig 与树影角度持续变化。
