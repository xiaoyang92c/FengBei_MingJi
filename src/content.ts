export const sources = {
  course: { title: '《设计管理·数字媒体时代的AI内容生成设计与传播》课件，第10、16、19页', url: '', note: '章节任务与纪念碑参考照片；照片授权范围待确认。' },
  neijiang: { title: '内江广播电视台：《打卡内江红色地标——成渝铁路筑路民工纪念堂》', url: 'https://site.scnj.tv/wap/showplay.php?id=1938901', note: '纪念碑题名、建碑背景、劳动方式及通车日期的文字依据。' },
  heritage: { title: '四川省人民政府：第九批省级文物保护单位名录', url: 'https://www.sc.gov.cn/zfgb/2017/xiazai/2019-03.pdf', note: '纪念堂与纪念碑的文物保护单位信息。' },
} as const;
export type SourceId = keyof typeof sources;
export type RoomId = 'monument' | 'worksite' | 'archive';
export type ClueId = 'title' | 'memorial' | 'tools' | 'together' | 'opening';
export interface Room { id: RoomId; number: string; title: string; subtitle: string; statement: string; scene: string; sceneFocusY?: number; desktopScene: string; desktopFocusY?: number; door: string; reconstruction: string; }
export interface ClueStep { kind: '所见' | '史料' | '解读'; title: string; body: string; }
export interface Clue { id: ClueId; roomId: RoomId; number: string; label: string; title: string; lead: string; steps: [ClueStep, ClueStep, ClueStep]; sourceId: SourceId; x: number; y: number; visual: 'inscription' | 'base' | 'hammer' | 'rail' | 'date'; }
export const rooms: Room[] = [
  { id: 'worksite', number: 'I', title: '开山筑路', subtitle: '锤落在钎上，钎凿进石头。', statement: '先有一下一下的锤声，才有火车声。', scene: '/assets/scenes/worksite-real-v42.webp', desktopScene: '/assets/scenes/worksite-wide-v43.webp', door: '/assets/scenes/portal-worksite-v5.webp', reconstruction: '写实场景创作 · 非历史现场照片' },
  { id: 'archive', number: 'II', title: '铁路贯通', subtitle: '1952年7月1日，全线通车。', statement: '火车走过的地方，先有人修过。', scene: '/assets/scenes/opening-real-v42.webp', desktopScene: '/assets/scenes/opening-wide-v43.webp', desktopFocusY: .47, door: '/assets/scenes/portal-archive-v5.webp', reconstruction: '写实场景创作 · 非历史现场照片' },
  { id: 'monument', number: 'III', title: '回到碑前', subtitle: '碑名里，写着“筑路民工”。', statement: '路通了，还要记住是谁修的。', scene: '/assets/scenes/memorial-real-v42.webp', sceneFocusY: .565, desktopScene: '/assets/scenes/memorial-wide-v43.webp', desktopFocusY: .44, door: '/assets/scenes/portal-monument-v5.webp', reconstruction: '参照实碑形制的写实创作 · 非实景照片' },
];
const clueEntries: Clue[] = [
  {
    id: 'title', roomId: 'monument', number: '04', label: '碑上的字',
    title: '碑名里，写的是谁？', lead: '先读铁路的名字，再读“筑路民工”。这座碑，为修路的人而立。',
    steps: [
      { kind: '所见', title: '把这四个字读出来', body: '成渝铁路，筑路民工，纪念碑。从上往下读，铁路的名字后面，就是修路的人。先停在“筑路民工”这四个字上。' },
      { kind: '史料', title: '碑名是这样写的', body: '内江地方资料记载：第四级主碑体的南、北两面，均以隶书阴刻“成渝铁路筑路民工纪念碑”。' },
      { kind: '解读', title: '从工地，读到碑上', body: '刚才在工地里看到的，是钎、锤和铁轨。读到这里，碑名把人写了出来：“筑路民工”。凿石头、修路基的那些人，值得让后来的人停下来，认真读到一次。' },
    ],
    sourceId: 'neijiang', x: 50, y: 43, visual: 'inscription',
  },
  {
    id: 'memorial', roomId: 'monument', number: '05', label: '通车之后',
    title: '通车之后，还有一座碑', lead: '路通了两年。1954年7月1日，碑上记下奠基。',
    steps: [
      { kind: '所见', title: '从下面一层，往上看', body: '黄砂石的碑体，从下往上分为四级，逐层收小。资料记载，它高14米。场景参照实碑形制创作，图记按层级画出示意。' },
      { kind: '史料', title: '两个日期，相隔两年', body: '1952年7月1日，成渝铁路全线通车。第二级碑身南面的题记是“一九五四年七月一日奠基”。通车以后，又过了两年。' },
      { kind: '解读', title: '火车走了，碑还在这里', body: '通车的日子，有了记录。为筑路民工立碑，也留下了日期。一条路修好了，还要有个地方，让后来的人知道是谁修的。走到这里，再把碑名读完。' },
    ],
    sourceId: 'neijiang', x: 50, y: 66, visual: 'base',
  },
  {
    id: 'tools', roomId: 'worksite', number: '01', label: '钢钎与大锤',
    title: '先凿开石头，才铺得上铁轨', lead: '钎尖顶着石头。锤头落在钎尾。路还没通，活得一下一下地干。',
    steps: [
      { kind: '所见', title: '锤头落在哪里', body: '钎尖抵住石头，锤头敲在钎尾。抡起，落下，再抡起。要把铁轨铺上去，先得凿开石头，把路基修好。' },
      { kind: '史料', title: '资料里记着这些工具', body: '内江地方资料记载，筑路建设者曾用钢钎、大锤等工具开凿路基。铺轨之前，先要把路基修好。' },
      { kind: '解读', title: '车轮很快，落锤很慢', body: '火车很快就能开过这一段。修路的时候，锤子却要反复抡起，石头要一点一点凿开。看见铁轨，再想想握着这些工具的手。' },
    ],
    sourceId: 'neijiang', x: 46, y: 71, visual: 'hammer',
  },
  {
    id: 'together', roomId: 'worksite', number: '02', label: '一起修路',
    title: '一条路，要有许多人一起干', lead: '解放军，民工。两种身份，都在修这条铁路的资料里。',
    steps: [
      { kind: '所见', title: '把两边的轨道接起来', body: '图上的两段轨道，最后接成一条。工地上的活也要接着做：石头凿开，路基修好，铁轨再铺上来。哪一段，都得有人干。' },
      { kind: '史料', title: '解放军和民工', body: '解放军和民工都参与了成渝铁路建设。地方资料分别记下了他们参与修路的事。' },
      { kind: '解读', title: '干过的活，留在路上', body: '资料里写的是“解放军”和“民工”。回到工地上，就是一个个拿着工具干活的人。后来火车开过去，他们做过的活，就在车轮下面。' },
    ],
    sourceId: 'neijiang', x: 52, y: 43, visual: 'rail',
  },
  {
    id: 'opening', roomId: 'archive', number: '03', label: '全线通车',
    title: '那一天，火车通了', lead: '1952年7月1日。此前要靠人一段段修的路，终于能让火车沿线开过去。',
    steps: [
      { kind: '所见', title: '让火车沿着轨道开过去', body: '顺着两根钢轨，看向山谷的远处。火车能一直开下去，前面的路就得一直接着。曾经一处处干的活，到通车时，连在了一起。' },
      { kind: '史料', title: '两个日期之间', body: '1950年6月15日，成渝铁路开工。1952年7月1日，全线通车。资料留下了这两个日期，修路的日子就在中间。' },
      { kind: '解读', title: '两个日期，许多修路的日子', body: '开工和通车，写下来只占两行。中间的日子，却要有人一天接一天地干。列车开走了，我们再去碑前看看，那里写着修路的人。' },
    ],
    sourceId: 'neijiang', x: 50, y: 43, visual: 'date',
  },
];
export const clues = clueEntries.sort((a, b) => Number(a.number) - Number(b.number));
