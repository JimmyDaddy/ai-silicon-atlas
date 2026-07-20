export type StageKey =
  | "eda-ip"
  | "design"
  | "equipment-materials"
  | "manufacturing"
  | "memory"
  | "packaging"
  | "ai-infrastructure"
  | "models-platforms"
  | "ai-applications";

export interface IndustryStage {
  key: StageKey;
  index: string;
  name: string;
  nameEn: string;
  shortDescription: string;
  description: string;
  signal: string;
  accent: string;
}

export const stages: IndustryStage[] = [
  {
    key: "eda-ip",
    index: "01",
    name: "EDA 与 IP",
    nameEn: "EDA & IP",
    shortDescription: "芯片设计的工具、接口与基础模块",
    description:
      "连接架构想法与可制造版图，关注设计复杂度、先进制程迁移、接口标准和授权模式。",
    signal: "研发投入、先进节点设计启动、订阅与授权收入",
    accent: "#a78bfa",
  },
  {
    key: "design",
    index: "02",
    name: "芯片设计",
    nameEn: "Fabless & Design",
    shortDescription: "定义计算、连接与专用芯片的价值",
    description:
      "从 GPU、CPU 到网络与通信芯片，关注终端需求、产品迭代、ASP 和供应约束。",
    signal: "产品周期、出货量、平均售价、订单与库存",
    accent: "#60a5fa",
  },
  {
    key: "equipment-materials",
    index: "03",
    name: "设备与材料",
    nameEn: "Equipment & Materials",
    shortDescription: "扩产和工艺升级背后的基础设施",
    description:
      "光刻、沉积、刻蚀、量测与晶圆材料共同决定工艺能力，资本开支是最重要的需求线索。",
    signal: "晶圆厂资本开支、积压订单、装机与服务收入",
    accent: "#f59e0b",
  },
  {
    key: "manufacturing",
    index: "04",
    name: "晶圆制造",
    nameEn: "Foundry & IDM",
    shortDescription: "把芯片设计转化为规模化制造",
    description:
      "先进与成熟制程并存，关注节点迁移、产能利用率、良率、晶圆价格和地域布局。",
    signal: "产能利用率、制程结构、毛利率与资本开支",
    accent: "#34d399",
  },
  {
    key: "memory",
    index: "05",
    name: "存储",
    nameEn: "Memory",
    shortDescription: "典型周期行业，也是 AI 系统的关键瓶颈",
    description:
      "DRAM、NAND 与 HBM 的供需和产品组合变化快，价格、库存与位元供给是核心变量。",
    signal: "合约价格、库存天数、位元增长与 HBM 产能",
    accent: "#fb7185",
  },
  {
    key: "packaging",
    index: "06",
    name: "封装与测试",
    nameEn: "Packaging & Test",
    shortDescription: "先进算力从单芯片走向系统级集成",
    description:
      "先进封装、Chiplet 和测试能力正在成为性能与交付速度的重要约束。",
    signal: "先进封装产能、利用率、单机价值量与客户认证",
    accent: "#22d3ee",
  },
  {
    key: "ai-infrastructure",
    index: "07",
    name: "AI 基础设施",
    nameEn: "AI Infrastructure",
    shortDescription: "服务器、网络、数据中心与电力散热",
    description:
      "把芯片组合成可用算力，关注服务器交付、高速网络、机柜功率、数据中心容量与云资本开支。",
    signal: "云厂商资本开支、网络带宽、机柜功率与数据中心上架",
    accent: "#2dd4bf",
  },
  {
    key: "models-platforms",
    index: "08",
    name: "模型与平台",
    nameEn: "Models & Platforms",
    shortDescription: "基础模型、云平台与开发者生态",
    description:
      "把算力转化为模型能力与平台服务，关注训练和推理成本、调用量、开发者生态及商业化路径。",
    signal: "AI 收入、模型调用量、推理成本与云业务增长",
    accent: "#c084fc",
  },
  {
    key: "ai-applications",
    index: "09",
    name: "AI 应用",
    nameEn: "AI Applications",
    shortDescription: "企业软件、内容工具与行业智能化",
    description:
      "AI 最终需要进入真实工作流并创造收入，关注付费渗透、单位经济、续费率和生产率提升。",
    signal: "AI 产品付费率、客单价、留存率与推理成本",
    accent: "#f472b6",
  },
];

export const stageByKey = Object.fromEntries(
  stages.map((stage) => [stage.key, stage]),
) as Record<StageKey, IndustryStage>;
