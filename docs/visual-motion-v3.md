# 场景与动效优化 · 2026-10-13

保留三处空间、五条线索、记忆册和终章的流程。视觉采用石灰灰、木褐、低饱和植被绿与纸白；宋体负责标题，黑体负责控制与阅读。场景的光线和物件承担视觉重点，界面不再使用倾斜纸片和重边框。

## 素材

以下四张图片均由内置 imagegen 生成，不是史料，不可用来证明历史现场、工具形制或纪念碑周边环境。原始 PNG 保存在 Codex generated_images，网页资产已复制并编码到项目目录。

| 文件 | 用途 | 体积 |
| --- | --- | --- |
| `public/assets/scenes/memorial-court-v3.webp` | 碑前艺术化环境，叠加真实 GLB | 419 KB |
| `public/assets/scenes/railway-worksite-v3.webp` | 筑路劳动的艺术化展陈 | 319 KB |
| `public/assets/scenes/archive-room-v3.webp` | 档案室艺术化环境，纸页无史料文字 | 209 KB |
| `public/assets/model/limestone-v3.jpg` | GLB 石材基色，嵌入模型 | 见文件大小 |

## 动效规格

- 入口与房间使用同一个持续存在的环境层；从入口裁切框连续展开至全屏，同时推进画面与三维相机，不使用遮黑切页。
- 界面先在 240ms 内退出，空间运动约 1550ms，文字和热点在运动后半段显现。
- 切换入口按方向做轻微横移和交叉淡入，预先解码下一张图片。
- 点击线索，沿物件位置放大画面；阅读面板在推进开始 550ms 后展开。
- 返回恢复房间镜头和此前拖动偏移。三维相机位置与观察目标共用相同缓动时间。
- 系统减少动态效果开启时，跳过镜头、面板和热点动画。

## 生成提示词

使用内置 imagegen；未调用付费 API CLI。以下为实际生成提示词。

### 碑前

Use case: stylized-concept. Create a premium cinematic architectural environment image for a mobile interactive museum about Chinese railway builders. Portrait 2:3 composition. A quiet open-air memorial court in grey limestone and weathered concrete, elegant contemporary exhibition design, mountains and fine bamboo foliage far behind, damp flagstone ground, atmospheric morning light entering from upper left, detailed stone pores, subtle warm neutral olive-grey tones. Central area MUST be empty and unobstructed with a plain ground platform at lower center; a real 3D tall narrow monument will be composited here in code. Strong believable perspective, camera low and facing straight ahead. Edge architecture and vegetation frame the scene. Photorealistic art-directed 3D render, tactile, restrained, beautiful soft shadows and depth. No monument, no obelisk, no people, no words, no signs, no UI, no borders, no illustration or vector style. Original artistic exhibition reconstruction, not an archival photograph.

### 筑路现场

Use case: stylized-concept. Portrait 2:3 premium photorealistic cinematic 3D environment for an immersive mobile museum about construction of the Chengdu Chongqing railway. An original artistic exhibition stage evoking mid-century railway labor, not an archival historical photograph. Empty human-scale workshop opening toward hazy mountain railway cutting. In lower LEFT at 28% across, 66% down: a beautifully lit weathered steel sledgehammer and iron chisel resting on a heavy dark wood workbench. In middle RIGHT at 72% across, 57% down: a length of old iron rail and coiled natural rope over pale stone gravel. Strong atmospheric depth, foreground timber framing on edges, dark desaturated brown and stone palette, restrained amber shaft of morning light through dust from upper left. Tactile rough stone, rusty metal, aged timber, cinematic lens quality, natural detailed material surfaces, careful composition with quiet dark upper third for a small heading. No people, no text or letters, no signage, no UI, no watermark, no vector illustration. Realistic natural proportions, premium contemporary exhibition art direction.

### 档案室

Use case: stylized-concept. Portrait 2:3 photorealistic cinematic environment for a premium immersive mobile museum about railway memory. Original imaginary archival exhibition room, no authentic documents represented. Dark walnut flat-file cabinets and shelves line either side of a tall narrow room. A broad wooden desk in the lower half, an open blank cream paper folio centered at 55% across and 62% down, a small unlit brass lamp on left, several plain linen folders, a simple magnifying glass. Warm morning sun enters tall window at back left, catches suspended dust, exquisite soft chiaroscuro, desaturated umber olive grey cream palette. Dark quiet upper quarter for small heading. Strong single-point perspective and architectural depth toward back wall; tactile paper fibers and worn oak grain; museum atmosphere contemporary restrained art direction, premium architectural photographic quality. No people, no readable text, no fabricated historical photos, no numbers, no logos, no UI, no borders, no vector graphic aesthetic.

### 石材

Use case: product-mockup. Asset type: seamless PBR base color texture. Square image of pale cool grey limestone used in a Chinese memorial monument. Orthographic flat surface scan, seamless tileable edge-to-edge stone texture with fine pores and subtle mineral mottling, very fine natural grain, restrained age staining, neutral mid grey stone #aaa99e. Uniform diffuse illumination, absolutely no directional shadows, no perspective, no cracks, no large veins, no objects, no writing, no frame. Real photographic material scan, quiet realistic low contrast. This will be used as a repeating stone material on a three-dimensional monument.

## 实现边界

碑体为 Three.js GLB 三维资产，其他环境为有镜头运动的位图展陈。它们不是可自由行走的完整三维建筑。正式档案、人物素材与馆际导航地址仍沿用 README 的待补说明。
