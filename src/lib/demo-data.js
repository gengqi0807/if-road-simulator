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

export const analysisFor = (stepIndex, choice) => ({
  title: `你选了「${choice.text}」`,
  content: stepIndex === 1
    ? '预计 2 天能记住公式，但第 3 天会遇到“为什么必须是 0/0 或 ∞/∞”的适用前提问题。'
    : '这条路径会降低卡点概率，但会增加约 2 天时间成本。',
  pitfalls: [{ name: '适用前提', probability: 0.73 }],
  metrics_delta: { time_days: 2, mastery: 0.14, exam_benefit: 0.1, risk: 0.08 },
  next_options: [],
  evidence: [{ title: '洛必达法则适用前提讨论', url: 'https://www.zhihu.com/', year: 2024 }],
  freshness: [{ level: 'slightly_old', reason: '2019 年高赞回答，2024 年有更新' }],
  confidence: 0.86,
});
