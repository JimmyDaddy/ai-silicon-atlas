import type { StageKey } from "./stages";

export interface ResearchTheme {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  question: string;
  signals: string[];
  stages: StageKey[];
  tone: "cyan" | "amber" | "violet";
}

export const themes: ResearchTheme[] = [
  {
    slug: "ai-accelerator-hbm",
    eyebrow: "AI 全链",
    title: "算力需求如何向上游传导",
    summary: "从模型训练与推理需求出发，观察加速器、HBM、先进封装与晶圆制造之间的约束传导。",
    question: "AI 收入增长最终落在哪些产能与价值量上？",
    signals: ["模型调用量", "云资本开支", "加速器与 HBM 供给"],
    stages: ["models-platforms", "ai-infrastructure", "design", "memory", "packaging"],
    tone: "cyan",
  },
  {
    slug: "advanced-packaging",
    eyebrow: "制造链",
    title: "先进封装",
    summary: "Chiplet 与异构集成提升系统性能，也让封装、基板、测试成为新的瓶颈。",
    question: "产能扩张能否跟上设计复杂度的提升？",
    signals: ["封装扩产", "良率与利用率", "客户认证"],
    stages: ["packaging", "manufacturing", "equipment-materials"],
    tone: "amber",
  },
  {
    slug: "fab-capex",
    eyebrow: "周期链",
    title: "晶圆厂资本开支",
    summary: "设备订单通常领先产能释放，节点结构比资本开支总额更能说明价值分配。",
    question: "钱投向哪里，何时转化成收入与产能？",
    signals: ["资本开支指引", "设备积压订单", "节点与地域结构"],
    stages: ["equipment-materials", "manufacturing", "eda-ip"],
    tone: "violet",
  },
  {
    slug: "ai-infrastructure-capex",
    eyebrow: "基础设施",
    title: "AI 数据中心资本开支",
    summary: "服务器、交换机、光互连、电力和散热共同决定算力集群能否按时上线。",
    question: "除了 GPU，新增资本开支还流向了哪里？",
    signals: ["云厂商资本开支", "网络升级周期", "电力与散热订单"],
    stages: ["ai-infrastructure", "design", "equipment-materials"],
    tone: "cyan",
  },
  {
    slug: "model-application-economics",
    eyebrow: "商业化",
    title: "模型与应用的单位经济",
    summary: "从模型调用成本、AI 产品定价到续费与使用深度，判断应用收入能否覆盖推理成本。",
    question: "AI 功能是在创造新增收入，还是只增加成本？",
    signals: ["AI 产品收入", "推理成本", "付费渗透与留存"],
    stages: ["models-platforms", "ai-applications", "ai-infrastructure"],
    tone: "violet",
  },
];
