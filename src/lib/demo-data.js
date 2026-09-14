export const demoPath = {
  goal: '我想学会洛必达法则',
  scene: 'subject',
  constraints: { daily_minutes: 60, deadline_days: 14, level: 'beginner', target: 'final_exam' },
  steps: [
    {
      title: '你打算从哪里开始？',
      options: [
        { key: 'A', text: '先学极限，打好基础', meta: '稳健 · 预计 5 天' },
        { key: 'B', text: '直接学洛必达，遇到问题再补', meta: '速通 · 预计 2 天' },
        { key: 'C', text: '先刷题，感受一下难度', meta: '实践 · 预计 3 天' },
        { key: 'D', text: '先看几何直觉，建立画面感', meta: '理解 · 预计 4 天' },
      ],
    },
    {
      title: '下一步，你想怎么做？',
      options: [
        { key: 'A', text: '回头补极限', meta: '降低卡点风险 · +2 天' },
        { key: 'B', text: '继续硬扛', meta: '节省时间 · 卡点概率 73%' },
        { key: 'C', text: '换几何直觉路线', meta: '理解优先 · +1 天' },
        { key: 'D', text: '先刷题，边刷边补', meta: '以练代学 · 遗忘速度较快' },
      ],
    },
    {
      title: '你准备如何巩固？',
      options: [
        { key: 'A', text: '补完极限，再学洛必达', meta: '稳通 · +3 天' },
        { key: 'B', text: '补一半极限，穿插洛必达', meta: '平衡 · +2 天' },
        { key: 'C', text: '只补与洛必达相关的部分', meta: '速通 · +1 天' },
      ],
    },
  ],
};

// 根据用户目标生成第一步的决策问题和选项。这里使用轻量规则，
// 让离线演示也能体现“目标驱动”，不依赖 LLM 或外部服务。
export function buildGoalFirstStep(goal = '', constraints = {}) {
  const value = String(goal).trim();
  const normalized = value.toLowerCase();
  const has = (...words) => words.some((word) => normalized.includes(word));
  const level = constraints.level || '';
  const suffix = value ? `「${value.length > 24 ? `${value.slice(0, 24)}…` : value}」` : '这个目标';

  if (has('洛必达', '极限', '微积分')) {
    return {
      title: `为了${suffix}，你打算从哪里开始？`,
      options: [
        { key: 'A', text: '先学极限，打好基础', meta: '稳健 · 预计 5 天' },
        { key: 'B', text: '直接学洛必达，遇到问题再补', meta: '速通 · 预计 2 天' },
        { key: 'C', text: '先刷题，感受一下难度', meta: '实践 · 预计 3 天' },
        { key: 'D', text: '先看几何直觉，建立画面感', meta: '理解 · 预计 4 天' },
      ],
    };
  }

  if (has('英语', '英文', '雅思', '托福', 'english')) {
    return {
      title: `为了${suffix}，你想先突破哪一块？`,
      options: [
        { key: 'A', text: '先补高频词汇和基础语法', meta: '稳健 · 建立输入基础' },
        { key: 'B', text: '直接做真题，边做边补短板', meta: '速通 · 及时暴露问题' },
        { key: 'C', text: '先练听说，尽快获得表达反馈', meta: '实践 · 强化输出' },
        { key: 'D', text: '先制定每天可执行的学习节奏', meta: '规划 · 降低中途放弃风险' },
      ],
    };
  }

  if (has('日语', '日文', '日语能力', 'jlpt', 'n1', 'n2', 'n3', 'n4', 'n5')) {
    return {
      title: `为了${suffix}，你准备先从哪一步开始？`,
      options: [
        { key: 'A', text: '先做日语水平摸底，确认五十音、词汇和听力短板', meta: '诊断 · 找到最值得投入的环节' },
        { key: 'B', text: '先掌握五十音和基础发音，再进入入门语法', meta: '基础 · 建立可持续输入' },
        { key: 'C', text: '跟着一套初级教材完成第一课到对话练习', meta: '跟练 · 尽快形成学习闭环' },
        { key: 'D', text: '先确定 JLPT 等级目标，倒排每天的词汇与听力任务', meta: '规划 · 让目标可衡量' },
      ],
    };
  }

  if (has('六级', '四级', '考试', '备考', '考研')) {
    return {
      title: `为了${suffix}，你准备先锁定哪项突破？`,
      options: [
        { key: 'A', text: '先做一套摸底题，定位听力、阅读、写作等短板', meta: '诊断 · 先确定提分优先级' },
        { key: 'B', text: '先按考试要求整理高频词汇和核心语法', meta: '基础 · 建立稳定输入' },
        { key: 'C', text: '直接按考试时间练一套真题，适应节奏', meta: '实战 · 快速校准时间分配' },
        { key: 'D', text: '先制定到考试日期的周计划和每日任务', meta: '规划 · 保证长期执行' },
      ],
    };
  }

  if (has('编程', '代码', 'python', 'javascript', 'java', '程序')) {
    return {
      title: `为了${suffix}，你准备怎样开始？`,
      options: [
        { key: 'A', text: '先过一遍核心概念和语法', meta: '稳健 · 先搭知识骨架' },
        { key: 'B', text: '直接做一个小项目，遇到问题再查', meta: '项目驱动 · 快速见成果' },
        { key: 'C', text: '跟着课程/教程完整练一遍', meta: '跟练 · 降低入门门槛' },
        { key: 'D', text: '先刷题熟悉常见模式', meta: '练习 · 强化解题速度' },
      ],
    };
  }

  if (has('健身', '减脂', '增肌', '跑步', '体能')) {
    return {
      title: `为了${suffix}，你想先建立哪种基础？`,
      options: [
        { key: 'A', text: '先评估现状并制定可持续计划', meta: '稳健 · 量力而行' },
        { key: 'B', text: '直接开始训练，边练边调整', meta: '行动 · 尽快形成习惯' },
        { key: 'C', text: '先调整饮食和作息', meta: '基础 · 优先改善生活方式' },
        { key: 'D', text: '先记录数据，找到最关键的短板', meta: '测量 · 用反馈指导训练' },
      ],
    };
  }

  const beginnerText = /零基础|入门|不会/.test(level) ? '先拆解基础概念，搭好知识框架' : '先做一次小练习，定位自己的短板';
  return {
    title: `为了${suffix}，你打算从哪里开始？`,
    options: [
      { key: 'A', text: beginnerText, meta: '稳健 · 先建立可复用基础' },
      { key: 'B', text: '直接挑战一个接近目标的任务，遇到问题再补', meta: '速通 · 快速获得反馈' },
      { key: 'C', text: '跟着一套教程或范例完整走一遍', meta: '跟练 · 降低启动成本' },
      { key: 'D', text: '先拆解目标，制定每天能坚持的节奏', meta: '规划 · 控制时间与风险' },
    ],
  };
}

export function buildGoalNextStep(goal = '', stepIndex = 2, choiceText = '') {
  const normalized = String(goal).toLowerCase();
  const exam = /六级|四级|雅思|托福|考试|考研|备考/.test(normalized);
  const coding = /编程|代码|python|javascript|java|程序/.test(normalized);
  const japanese = /日语|日文|jlpt|n[1-5]/i.test(normalized);
  const title = `第 ${stepIndex} 步：围绕目标继续推进，你会怎么做？`;
  if (exam) return { title, options: [
    { key: 'A', text: '根据刚才的结果，优先补齐最薄弱的题型', meta: '诊断 · 提高投入回报' },
    { key: 'B', text: '按考试时间做一套完整真题并严格计时', meta: '实战 · 校准考试节奏' },
    { key: 'C', text: '整理错题并追溯对应的词汇、语法或方法', meta: '复盘 · 降低重复失分' },
    { key: 'D', text: '保持当前节奏，先完成今天的学习任务', meta: '稳态 · 防止计划中断' },
  ] };
  if (coding) return { title, options: [
    { key: 'A', text: '把刚才的思路拆成一个可运行的小功能', meta: '实践 · 快速验证' },
    { key: 'B', text: '查阅官方文档，补齐关键概念', meta: '基础 · 减少隐性坑' },
    { key: 'C', text: '调试并记录错误，形成可复用排查清单', meta: '复盘 · 提升独立解决能力' },
    { key: 'D', text: '换一个相近的小任务迁移练习', meta: '迁移 · 检验是否真正掌握' },
  ] };
  if (japanese) return { title, options: [
    { key: 'A', text: '用五十音和发音小测验证基础，再补错漏', meta: '诊断 · 稳固入门基础' },
    { key: 'B', text: '继续教材对话练习，并把新词放进例句', meta: '输入 · 建立语感' },
    { key: 'C', text: '集中记忆本阶段高频词汇，第二天做听写复测', meta: '词汇 · 用间隔复习巩固' },
    { key: 'D', text: '听一段对应等级的日语材料，记录听不懂的句子', meta: '听力 · 找到真实理解缺口' },
  ] };
  return { title, options: [
    { key: 'A', text: `针对「${choiceText || '当前选择'}」做一次小练习，验证是否理解`, meta: '验证 · 用结果调整路径' },
    { key: 'B', text: '查找可靠资料，补齐当前遇到的关键知识', meta: '补缺 · 降低卡点风险' },
    { key: 'C', text: '把目标拆成更小的里程碑并完成下一项', meta: '推进 · 保持可执行' },
    { key: 'D', text: '复盘当前进展，必要时调整学习策略', meta: '复盘 · 避免无效投入' },
  ] };
}

export const analysisFor = (stepIndex, choice, goal = demoPath.goal) => {
  const isCalculus = /洛必达|极限|微积分/.test(String(goal));
  return {
  title: `你选了「${choice.text}」`,
  content: isCalculus && stepIndex === 1
    ? '预计 2 天能记住公式，但第 3 天会遇到“为什么必须是 0/0 或 ∞/∞”的适用前提问题。'
    : isCalculus ? '这条路径会降低卡点概率，但会增加约 2 天时间成本。' : `围绕「${goal}」的这次选择会改变后续节奏。建议用一次小测或练习验证效果，再决定是否调整路径。`,
  pitfalls: [{ name: isCalculus ? '适用前提' : '执行与复盘不足', probability: isCalculus ? 0.73 : 0.42 }],
  metrics_delta: { time_days: 2, mastery: 0.14, exam_benefit: 0.1, risk: 0.08 },
  next_options: [],
  evidence: [{ title: isCalculus ? '洛必达法则适用前提讨论' : `${goal} 学习方法讨论`, url: 'https://www.zhihu.com/', year: 2024 }],
  freshness: [{ level: 'slightly_old', reason: '2019 年高赞回答，2024 年有更新' }],
  confidence: 0.86,
  };
};
