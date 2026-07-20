import type { StageKey } from "./stages";

export interface IndustryMapNode {
  stage: StageKey;
  x: number;
  y: number;
  zone: "silicon" | "systems" | "intelligence";
}

export interface IndustryMapEdge {
  id: string;
  source: StageKey;
  target: StageKey;
  label: string;
  description: string;
  strength: "primary" | "secondary" | "feedback";
}

export const industryMapNodes: IndustryMapNode[] = [
  { stage: "eda-ip", x: 11, y: 19, zone: "silicon" },
  { stage: "design", x: 30, y: 16, zone: "silicon" },
  { stage: "equipment-materials", x: 12, y: 62, zone: "silicon" },
  { stage: "manufacturing", x: 34, y: 54, zone: "silicon" },
  { stage: "memory", x: 54, y: 72, zone: "systems" },
  { stage: "packaging", x: 54, y: 36, zone: "systems" },
  { stage: "ai-infrastructure", x: 73, y: 38, zone: "systems" },
  { stage: "models-platforms", x: 89, y: 20, zone: "intelligence" },
  { stage: "ai-applications", x: 89, y: 66, zone: "intelligence" },
];

export const industryMapEdges: IndustryMapEdge[] = [
  {
    id: "tools-to-design",
    source: "eda-ip",
    target: "design",
    label: "设计工具与 IP",
    description: "架构、验证工具和接口 IP 决定复杂芯片能否按时完成设计。",
    strength: "primary",
  },
  {
    id: "equipment-to-fabs",
    source: "equipment-materials",
    target: "manufacturing",
    label: "设备与材料投入",
    description: "晶圆厂资本开支转化为设备订单、装机和材料消耗。",
    strength: "primary",
  },
  {
    id: "design-to-fabs",
    source: "design",
    target: "manufacturing",
    label: "流片与晶圆需求",
    description: "芯片设计通过流片进入晶圆制造，节点与良率决定成本和供给。",
    strength: "primary",
  },
  {
    id: "fabs-to-packaging",
    source: "manufacturing",
    target: "packaging",
    label: "晶圆到系统封装",
    description: "制造完成的裸片经过先进封装、互连和测试成为可交付器件。",
    strength: "primary",
  },
  {
    id: "fabs-to-memory",
    source: "manufacturing",
    target: "memory",
    label: "存储制造能力",
    description: "制程、设备和晶圆投入共同约束 DRAM、NAND 与 HBM 位元供给。",
    strength: "secondary",
  },
  {
    id: "memory-to-packaging",
    source: "memory",
    target: "packaging",
    label: "HBM 与异构集成",
    description: "高带宽存储通过堆叠和先进封装与加速器形成算力模块。",
    strength: "primary",
  },
  {
    id: "design-to-infrastructure",
    source: "design",
    target: "ai-infrastructure",
    label: "计算与网络芯片",
    description: "加速器、CPU、交换芯片和互连器件构成 AI 系统的计算底座。",
    strength: "secondary",
  },
  {
    id: "packaging-to-infrastructure",
    source: "packaging",
    target: "ai-infrastructure",
    label: "算力模块交付",
    description: "封装后的计算模块进入服务器、网络、机柜和数据中心。",
    strength: "primary",
  },
  {
    id: "infrastructure-to-models",
    source: "ai-infrastructure",
    target: "models-platforms",
    label: "训练与推理能力",
    description: "可用算力、网络和电力容量决定模型训练速度与推理成本。",
    strength: "primary",
  },
  {
    id: "models-to-applications",
    source: "models-platforms",
    target: "ai-applications",
    label: "模型能力与平台服务",
    description: "基础模型、云平台和开发工具把算力转化为可组合的产品能力。",
    strength: "primary",
  },
  {
    id: "applications-to-models",
    source: "ai-applications",
    target: "models-platforms",
    label: "使用反馈",
    description: "真实工作流中的使用量、留存和效果反馈推动模型与平台迭代。",
    strength: "feedback",
  },
  {
    id: "applications-to-infrastructure",
    source: "ai-applications",
    target: "ai-infrastructure",
    label: "推理需求回流",
    description: "应用渗透带来的调用量最终回流为推理算力、网络和电力需求。",
    strength: "feedback",
  },
];

export const mapZones = [
  { key: "silicon", label: "SILICON", description: "设计与制造" },
  { key: "systems", label: "SYSTEMS", description: "算力系统" },
  { key: "intelligence", label: "INTELLIGENCE", description: "模型与应用" },
] as const;

