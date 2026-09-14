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
