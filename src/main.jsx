import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowRight, BookOpen, Clock3, GitBranch, History, Lightbulb, RotateCcw, ShieldCheck, Sparkles, Target, TrendingUp, UserRound} from 'lucide-react';
import './styles.css';

const choices = [
  {key:'A', title:'先学极限，打好基础', meta:'稳健 · 预计 5 天', tone:'blue'},
  {key:'B', title:'直接学洛必达，遇到问题再补', meta:'速通 · 预计 2 天', tone:'purple'},
  {key:'C', title:'先刷题，感受一下难度', meta:'实践 · 预计 3 天', tone:'orange'},
  {key:'D', title:'先看几何直觉，建立画面感', meta:'理解 · 预计 4 天', tone:'green'},
];
const nextChoices = [
  {key:'A', title:'回头补极限', meta:'降低卡点风险 · +2 天'},
  {key:'B', title:'继续硬扛', meta:'节省时间 · 卡点概率 73%'},
  {key:'C', title:'换几何直觉路线', meta:'理解优先 · +1 天'},
  {key:'D', title:'先刷题，边刷边补', meta:'以练代学 · 遗忘速度较快'},
];

function App(){
  const [started,setStarted]=useState(false), [step,setStep]=useState(1), [selected,setSelected]=useState(null), [showAnalysis,setShowAnalysis]=useState(false), [goal,setGoal]=useState('我想学会洛必达法则');
  const choose=(c)=>{setSelected(c);setShowAnalysis(true)};
  const reset=()=>{setStarted(false);setStep(1);setSelected(null);setShowAnalysis(false)};
  if(!started) return <main className="landing"><div className="glow g1"/><div className="glow g2"/><nav><div className="brand"><div className="brand-mark">if</div><span>如果路</span></div><div className="nav-status"><span className="dot"/> Demo 模式 · 离线可用</div></nav><section className="hero"><div className="eyebrow"><Sparkles size={15}/> 游戏化学习决策模拟器</div><h1>人生有如果，<br/><em>决策有如果。</em></h1><p>把知乎上的学习经验，变成一步一步可交互、可回溯的选择模拟。</p><div className="entry-card"><div className="field-label">你的学习目标</div><div className="input-wrap"><Target size={19}/><input value={goal} onChange={e=>setGoal(e.target.value)}/></div><div className="chips"><button onClick={()=>setGoal('我想学会洛必达法则')}>洛必达法则</button><button onClick={()=>setGoal('我是大一计算机，想考研')}>计算机考研规划</button></div><button className="primary big" onClick={()=>setStarted(true)}>开始如果路 <ArrowRight size={18}/></button><div className="login-hint"><button className="link-btn"><UserRound size={15}/> 使用知乎登录</button><span>登录后可保存档案、发布攻略</span></div></div></section><div className="landing-foot"><span>知乎内容 × AI 推演 × 可回溯分支</span><span>© 2026 如果路</span></div></main>;
  return <main className="app-shell"><header className="topbar"><div className="brand"><div className="brand-mark">if</div><span>如果路</span><small>学习决策模拟器</small></div><div className="top-actions"><span className="save"><ShieldCheck size={15}/> 已自动存档</span><button className="icon-btn" onClick={reset}><RotateCcw size={17}/></button><div className="avatar">访</div></div></header><div className="progress"><div><span className="eyebrow">洛必达法则 · 学科知识</span><h2>你的如果路 <span>·</span> 第 {step} 步</h2></div><div className="stats"><div><Clock3 size={16}/><b>14</b><small>剩余天数</small></div><div><TrendingUp size={16}/><b>{selected?'42':'28'}%</b><small>掌握度</small></div><div><Lightbulb size={16}/><b>72</b><small>精力值</small></div></div></div><div className="workspace"><aside className="timeline"><div className="side-title"><History size={17}/> 路径时间线</div><div className="line"/>{[{n:1,t:selected?.title||'等待你的第一次选择',done:!!selected},{n:2,t:step>1?'回头补极限':'下一步分叉',done:step>1},{n:3,t:'结局与复盘',done:false}].map(x=><div className={'tl-item '+(x.done?'done':'')} key={x.n}><div className="tl-dot">{x.done?'✓':x.n}</div><div><b>第 {x.n} 步</b><p>{x.t}</p></div></div>)}<div className="side-tip"><GitBranch size={16}/><span>每一步都可以回溯，试试不同的选择。</span></div></aside><section className="content"><div className="question-card"><div className="card-kicker"><span className="step-badge">STEP {step}</span><span className="fresh">● 资料新鲜度 92%</span></div><h3>{step===1?'你打算从哪里开始？':'接下来，你想怎么做？'}</h3><p className="muted">只选择当前这一步，AI 会在你选择后分析它的后果。</p><div className="choices">{(step===1?choices:nextChoices).map(c=><button key={c.key} className={'choice '+(selected?.key===c.key?'picked':'')} onClick={()=>choose(c)}><span className="choice-key">{c.key}</span><span className="choice-copy"><strong>{c.title}</strong><small>{c.meta}</small></span><ArrowRight size={17}/></button>)}</div></div>{showAnalysis&&<div className="analysis-card"><div className="analysis-head"><div className="ai-icon"><Sparkles size={17}/></div><div><b>AI 后果分析</b><small>基于 36 条知乎学习经验生成</small></div><span className="confidence">置信度 0.86</span></div><p><strong>你选了「{selected.title}」。</strong> {step===1?'预计 2 天能记住公式，但第 3 天会遇到“为什么必须是 0/0 或 ∞/∞”的适用前提问题。':'这条路径会降低卡点概率，但会增加约 2 天时间成本。'} </p><div className="insights"><div><span className="i-label">可能卡点</span><b>适用前提</b><small>概率 73%</small></div><div><span className="i-label">时间成本</span><b>+2 天</b><small>每天 1 小时</small></div><div><span className="i-label">时效提醒</span><b className="warn">微旧</b><small>2024 年有更新</small></div></div><div className="source"><BookOpen size={15}/><span>知乎案例：2019 高赞回答未强调适用前提</span><a href="#">查看来源 ↗</a></div><button className="primary" onClick={()=>{setStep(Math.min(3,step+1));setSelected(null);setShowAnalysis(false)}}>{step<3?'进入下一步':'查看结局复盘'} <ArrowRight size={17}/></button></div>}</section></div></main>
}
createRoot(document.getElementById('root')).render(<App/>);
