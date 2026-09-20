// 提示词常量——两个技能语料的忠实压缩
// 语料原文见 prompts/xiaohei/ 与 prompts/handdrawn/（禁止改写语料，本文件是代码化压缩）
// v3：无结构化表单，结构/原型/标题等全部由组装器从大段文本自动推导（spec 2.2 自动推导规则）

// ============ 模式 A：小黑配图（ian-xiaohei-illustrations） ============

/** 视觉基因（源自 references/style-dna.md） */
export const STYLE_DNA = `Pure white background. Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.`;

/** 小黑 IP（源自 references/xiaohei-ip.md） */
export const XIAOHEI_IP = `小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression, slightly uneven hand-drawn body shape. 小黑 must perform the core conceptual action, not decorate the scene. Make 小黑 serious, deadpan, and slightly bizarre, not cute.`;

export interface StructureDef {
  label: string;
  /** 构图指引（源自 composition-patterns.md 的「画法」） */
  composition: string;
}

/** 8 种结构类型及构图指引（源自 references/composition-patterns.md） */
export const XIAOHEI_STRUCTURES: Record<string, StructureDef> = {
  workflow: {
    label: 'Workflow 流程',
    composition: '左侧输入，中间小黑或怪机器处理，右侧输出，橙色箭头表达主流向',
  },
  'system-part': {
    label: '系统局部',
    composition: '只画 3-5 个核心模块，小黑参与其中一个关键动作',
  },
  'before-after': {
    label: '前后对比',
    composition: '左混乱，右稳定，中间橙色箭头，角色可以更夸张',
  },
  'character-state': {
    label: '角色状态',
    composition: '2-4 个小状态，每个状态一个短标注',
  },
  'concept-metaphor': {
    label: '概念隐喻',
    composition: '一个大的怪物件或机器，少量输入，一个输出，要有记忆点',
  },
  'method-layers': {
    label: '方法分层',
    composition: '一层层盒子，不要正式金字塔；小黑在旁边搬砖或搭建',
  },
  'map-route': {
    label: '地图路线',
    composition: '一条弯曲路径，少量节点，小黑牵线或走路',
  },
  'comic-panels': {
    label: '小漫画分镜',
    composition: '2-4 个小场景，每格只表达一个动作',
  },
};

/** 模式 A 八段式模板（源自 references/prompt-template.md；v3：结构由模型按语义自选） */
export function buildXiaoheiPrompt(text: string): string {
  const excerpt = [...text].slice(0, 600).join('');

  return `Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA:
${STYLE_DNA}

Recurring IP character required:
${XIAOHEI_IP}

Source text (the article content to illustrate):
${excerpt}

Theme:
Read the source text and distill its core topic.

Structure type:
Choose the single most fitting structure from these 8 types: Workflow 流程 / 系统局部 / 前后对比 / 角色状态 / 概念隐喻 / 方法分层 / 地图路线 / 小漫画分镜. Use only one.

Core idea:
The one key judgment, structure, state or metaphor the source text conveys.

Composition:
Invent a fresh handdrawn scene that expresses this core idea, with 小黑 performing the core conceptual action. Do not copy prior examples or reuse known case compositions.

Suggested elements:
Pick 1-2 low-tech objects (e.g. 纸箱、抽屉、旧机器、漏斗、秤、邮筒、门、井、梯子、水管、转盘、怪工位) that fit the source text.

Chinese handwritten labels:
3-5 short handwritten Chinese annotations (each 2-8 characters) distilled from the source text.

Color use:
Black for main line art and 小黑. Orange for main flow/path/arrows. Red only for key warnings/problems/results. Blue only for secondary notes or feedback/system state.

Constraints:
One image explains only one core structure. Keep the main subject around 40%-60% of the canvas. Preserve at least 35% blank white space. Use at most 5-8 short handwritten Chinese labels. Do not write a title in the top-left corner. Do not write the structure type on the image. Do not make it a formal diagram, course slide, or dense explainer. It should be clear but not instructional, interesting but not childish, strange but clean.`;
}

// ============ 模式 B：手绘整页（ian-handdrawn-ppt） ============

/** Deck Style Lock（源自 references/prompt-patterns.md，逐句保留） */
export const STYLE_DNA_B = `Refined commercial Chinese handdrawn technical article/PPT illustration.
Complete raster image on very light warm white paper, near #FBFAF5, with extremely subtle grain.
No full-page border and no rectangular frame unless explicitly requested.
Upper-left small page number in handwritten style.
Centered medium Chinese title with one pale blue handdrawn underline.
Small subtitle under title when needed.
For body pages, keep title size optically consistent across pages; do not enlarge short titles.
Fine black ink and pencil linework, delicate hatching, stable but slightly irregular.
Muted pastel marker labels: pale blue, sage green, peach, lavender.
Sparse corner construction marks only: faint pale grey grid, dots, ruler ticks, measurement lines.
Generous negative space, calm premium teaching-note feeling.
Mostly small object-based diagrams; no more than one tiny person, placed far in a corner.
Props should be blank or contain only simple line marks unless their text appears in Required text only.
Avoid full-page border, yellow paper, beige paper, giant fonts, cheap poster look, childish doodles, many characters, thick marker strokes, dense bullets, corporate template style, shadows, gradients, neon, watermark, gibberish text, English filler.`;

/** Reference Match Clause（API 不支持参考图，语料规定用此条款提示词匹配风格） */
export const REFERENCE_MATCH_CLAUSE = `Match the approved article-illustration shell: near-white warm paper, no full-page border, upper-left small page number, centered restrained handwritten Chinese title, one pale blue underline, small subtitle beneath, sparse corner grid/dot construction marks, fine ink-and-pencil object drawings with delicate hatching, small refined central diagram, and large negative space.`;

/** Body 页面角色锁（源自 references/prompt-patterns.md Page Role Locks） */
export const BODY_ROLE_LOCK = `Page role: body illustration.
Canvas: 16:9.
This is not a cover page.
Title is medium and restrained.
Even if the title is short, do not enlarge it.
Central diagram occupies about 50-60% of page width and 35-45% of page height.`;

export interface ArchetypeDef {
  label: string;
  /** 构图结构（源自 references/slide-archetypes.md 的 Structure 条目） */
  composition: string;
}

/** 12 种原型（源自 references/slide-archetypes.md） */
export const HANDDRAWN_ARCHETYPES: Record<string, ArchetypeDef> = {
  'cover-metaphor': {
    label: '封面隐喻',
    composition:
      'Medium-to-large Chinese title, one main handdrawn metaphor, optional subtitle, optional small reader character.',
  },
  'single-concept': {
    label: '单概念拆解',
    composition:
      'Title, central concept label, two to four supporting annotations, small icon or metaphor.',
  },
  'left-right-contrast': {
    label: '左右对比',
    composition:
      'Two main groups, light divider or arrow, left can look messier and right more structured, one small conclusion.',
  },
  'transformation-contrast': {
    label: '前后转变对比',
    composition:
      'Two main groups showing a shift or upgrade, light divider or arrow, one small conclusion.',
  },
  'horizontal-process': {
    label: '横向流程',
    composition:
      'Thin line from left to right, four to seven small modules, light arrows, one or two annotation boxes.',
  },
  'circular-mechanism': {
    label: '循环机制',
    composition:
      'Three to six loop stages, curved arrows, center label for the mechanism, edge notes for exit conditions or risks.',
  },
  'branching-map': {
    label: '分支决策图',
    composition:
      'Central question or decision, three to five branches, each branch has a short condition and action.',
  },
  'classification-map': {
    label: '分类图',
    composition:
      'Parent concept, three to five branches, one to three micro labels under each branch.',
  },
  'matrix-table': {
    label: '矩阵表',
    composition:
      'Handdrawn grid, short row/column labels, small icons in selected cells, optional reader character at edge.',
  },
  'main-metaphor': {
    label: '主隐喻图',
    composition:
      'One large metaphor object or scene, thin arrows and labels around it, minimal small characters.',
  },
  'annotation-slide': {
    label: '警示批注页',
    composition:
      'A risk or caveat needs focused attention: one central warning object with concentrated annotations.',
  },
  takeaway: {
    label: '要点总结页',
    composition:
      'One clear judgment, three or fewer supporting echoes, small metaphor or icon.',
  },
};

/** 从文本推导精确标题：前 12 字（语料 Text Budget 5–12 字；不足 5 字补足） */
export function deriveTitle(text: string): string {
  const chars = [...text.replace(/\s+/g, ' ').trim()];
  if (chars.length >= 5) return chars.slice(0, 12).join('');
  // 不足 5 字：重复补足至 5 字（满足 Text Budget 下限）
  let title = chars.join('');
  while ([...title].length < 5) title += chars.join('') || '手绘配图';
  return [...title].slice(0, 12).join('');
}

/** 模式 B 十段式模板（源自 references/prompt-patterns.md Complete Page Image Prompt；v3：标题取文本前 12 字、原型由模型按语义自选） */
export function buildHanddrawnPrompt(text: string): string {
  const excerpt = [...text].slice(0, 600).join('');
  const title = deriveTitle(text);

  return `Use case: productivity-visual.
Asset type: one complete Chinese handdrawn technical article/PPT image, final raster page.

Page role: body illustration.
Title exactly: ${title}
Subtitle exactly: (none)
Archetype: Choose the single most fitting archetype from the source text semantics: 单概念拆解 / 左右对比 / 前后转变对比 / 横向流程 / 循环机制 / 分支决策图 / 分类图 / 矩阵表 / 主隐喻图 / 警示批注页 / 要点总结页. Use only one.
Main point: Read the source text below and distill its single main point in one sentence.

Source text:
${excerpt}

Apply the deck style lock:
${STYLE_DNA_B}

Reference match clause:
${REFERENCE_MATCH_CLAUSE}

Page role lock:
${BODY_ROLE_LOCK}

Composition:
Build an object-based handdrawn diagram (not generic boxes) that explains the main point of the source text. Vary the layout by the chosen archetype's semantic structure.

Scale lock:
Central diagram 50-60% page width and 35-45% page height; title same optical size as other body pages.

Required text only:
${title}, plus at most 5 short Chinese labels (each 2-6 characters) distilled from the source text. No other visible text.

Avoid:
full-page border, yellow paper, beige paper, oversized central objects, oversized body-page title, heavy bottom boxes, extra text, invented micro-labels, gibberish, English, watermark, crowded composition, many people, childish cartoons, thick outlines, saturated colors, corporate template look.`;
}
