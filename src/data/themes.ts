import type { StageKey } from "./stages";

export type ResearchIndicatorType = "leading" | "confirming" | "risk";
export type ResearchScenarioKey = "accelerating" | "base" | "constrained";

export interface ResearchMechanismStep {
  label: string;
  description: string;
}

export interface ResearchIndicator {
  label: string;
  type: ResearchIndicatorType;
  description: string;
  interpretation: string;
}

export interface ResearchScenario {
  key: ResearchScenarioKey;
  label: string;
  trigger: string;
  implications: string[];
}

export interface ResearchTheme {
  slug: string;
  eyebrow: string;
  title: string;
  summary: string;
  thesis: string;
  question: string;
  signals: string[];
  stages: StageKey[];
  tone: "cyan" | "amber" | "violet";
  mechanism: ResearchMechanismStep[];
  indicators: ResearchIndicator[];
  scenarios: ResearchScenario[];
  verification: string[];
  newsKeywords: string[];
}

export const indicatorTypeLabels: Record<ResearchIndicatorType, string> = {
  leading: "领先信号",
  confirming: "验证信号",
  risk: "反证信号",
};

export const themes: ResearchTheme[] = [
  {
    slug: "ai-accelerator-hbm",
    eyebrow: "AI 全链",
    title: "算力需求如何向上游传导",
    summary: "从模型训练与推理需求出发，观察加速器、HBM、先进封装与晶圆制造之间的约束传导。",
    thesis: "真正影响上游收入的不是模型热度本身，而是可计费调用量能否持续转化为云资本开支，并最终形成芯片、存储和封装的可交付订单。",
    question: "AI 收入增长最终落在哪些产能与价值量上？",
    signals: ["模型调用量", "云资本开支", "加速器与 HBM 供给"],
    stages: ["models-platforms", "ai-infrastructure", "design", "memory", "packaging"],
    tone: "cyan",
    mechanism: [
      { label: "工作负载", description: "训练规模、推理请求和上下文长度共同决定计算量。" },
      { label: "资本预算", description: "云厂商把预期需求转化为服务器、网络和数据中心预算。" },
      { label: "系统物料", description: "GPU、HBM、交换芯片与先进封装形成联动需求。" },
      { label: "产能兑现", description: "晶圆、封装良率与交付周期决定订单何时确认收入。" },
    ],
    indicators: [
      { label: "云厂商资本开支指引", type: "leading", description: "观察预算总额、AI 占比和上修频率。", interpretation: "连续上修通常先于服务器和网络订单，但要区分土地、电力与 IT 设备投入。" },
      { label: "加速器与 HBM 交付周期", type: "confirming", description: "观察供货承诺、认证节奏和新增产能。", interpretation: "交付周期维持高位且产能被预订，才说明需求真正传到上游。" },
      { label: "推理单位成本", type: "leading", description: "跟踪每 token 或每任务成本下降速度。", interpretation: "成本下降可能扩大调用量，也可能压低单次价值，需要同时看总使用量。" },
      { label: "客户集中与重复预订", type: "risk", description: "检查订单是否依赖少数客户或重复计算。", interpretation: "客户削减预算、延迟机房上线或取消重复订单会打断传导链。" },
    ],
    scenarios: [
      { key: "accelerating", label: "需求加速", trigger: "模型调用量和云资本开支同时上修，HBM 与先进封装利用率维持高位。", implications: ["系统瓶颈从单颗 GPU 扩展到存储、封装和网络", "上游扩产仍可能晚于需求，交付周期保持紧张", "需要重点验证新增算力能否转化为可计费收入"] },
      { key: "base", label: "有序扩张", trigger: "资本开支保持增长，但供应改善使交付周期逐步正常化。", implications: ["增长从缺货溢价转向产品结构和执行效率", "不同芯片与云平台的份额分化加大", "单位成本下降推动更多推理场景落地"] },
      { key: "constrained", label: "传导受阻", trigger: "数据中心上线延迟、客户预算下修，或应用收入未能覆盖推理成本。", implications: ["库存和重复订单风险首先出现在系统与零部件环节", "HBM 与封装扩产可能形成阶段性供给压力", "估值叙事会更依赖真实收入和现金流验证"] },
    ],
    verification: ["云资本开支中有多少真正进入计算、网络与存储设备？", "加速器订单是否对应已取得电力和机房容量的项目？", "推理调用增长能否抵消单位价格下降？"],
    newsKeywords: ["GPU", "HBM", "accelerator", "算力", "AI investment", "Vera Rubin"],
  },
  {
    slug: "advanced-packaging",
    eyebrow: "制造链",
    title: "先进封装",
    summary: "Chiplet 与异构集成提升系统性能，也让封装、基板、测试成为新的瓶颈。",
    thesis: "先进封装的价值不只来自产能数量，而在于高密度互连、良率控制、测试覆盖与客户协同能否共同支持更复杂的系统级产品。",
    question: "产能扩张能否跟上设计复杂度的提升？",
    signals: ["封装扩产", "良率与利用率", "客户认证"],
    stages: ["packaging", "manufacturing", "equipment-materials"],
    tone: "amber",
    mechanism: [
      { label: "架构变化", description: "Chiplet、HBM 堆叠和更大中介层提高集成复杂度。" },
      { label: "工艺投入", description: "键合、沉积、检测和基板设备的步骤与价值量增加。" },
      { label: "良率爬坡", description: "多颗裸片共同封装放大单点缺陷对最终良率的影响。" },
      { label: "客户认证", description: "可靠性、热管理和量产稳定性决定产能是否真正可用。" },
    ],
    indicators: [
      { label: "先进封装月产能", type: "leading", description: "区分规划、装机、认证和可量产产能。", interpretation: "只有设备到位且通过客户认证的产能才具有实际供给意义。" },
      { label: "良率与返工率", type: "confirming", description: "观察新工艺爬坡和多芯片集成损耗。", interpretation: "良率改善会同时提升有效产出、毛利和客户交付确定性。" },
      { label: "检测设备强度", type: "leading", description: "跟踪每片或每封装的检测步骤变化。", interpretation: "复杂度上升往往提高检测与量测价值量，早于最终产出释放。" },
      { label: "扩产同步性", type: "risk", description: "关注封装、基板、HBM 与晶圆供给是否错配。", interpretation: "任一配套环节落后都可能使名义产能无法转化为系统出货。" },
    ],
    scenarios: [
      { key: "accelerating", label: "复杂度加速", trigger: "HBM 堆叠、Chiplet 数量与封装面积持续提高。", implications: ["设备、材料和测试步骤的单位价值量上升", "头部供应商的协同设计能力更重要", "良率和热管理成为交付节奏核心变量"] },
      { key: "base", label: "产能跟进", trigger: "扩产与认证按计划推进，供需紧张逐步缓解。", implications: ["竞争重点从产能稀缺转向成本、良率与交期", "客户会增加第二供应来源以降低集中风险", "标准化 Chiplet 接口有助扩大生态"] },
      { key: "constrained", label: "配套错位", trigger: "基板、设备或 HBM 供给未同步，新增封装线利用率不足。", implications: ["项目延期造成资本回报周期拉长", "订单可能在不同封装方案之间迁移", "需要警惕名义扩产与有效产出的差距"] },
    ],
    verification: ["披露的扩产是设备到厂、客户认证还是已经量产？", "良率改善来自工艺成熟还是产品组合变化？", "封装、基板、HBM 与测试能力是否同步扩张？"],
    newsKeywords: ["advanced packaging", "chiplet", "CoWoS", "封装", "HBM"],
  },
  {
    slug: "fab-capex",
    eyebrow: "周期链",
    title: "晶圆厂资本开支",
    summary: "设备订单通常领先产能释放，节点结构比资本开支总额更能说明价值分配。",
    thesis: "同样规模的资本开支会因制程节点、设备类型、建厂地区和量产时点不同，产生完全不同的设备收入、折旧压力与供需结果。",
    question: "钱投向哪里，何时转化成收入与产能？",
    signals: ["资本开支指引", "设备积压订单", "节点与地域结构"],
    stages: ["equipment-materials", "manufacturing", "eda-ip"],
    tone: "violet",
    mechanism: [
      { label: "需求判断", description: "晶圆厂根据客户路线图和利用率决定扩产。" },
      { label: "设备订单", description: "长交期设备先形成积压订单与预付款。" },
      { label: "安装认证", description: "厂房、设备安装和工艺认证决定产能释放时间。" },
      { label: "折旧供给", description: "新产能进入报表后同时增加折旧与行业供给。" },
    ],
    indicators: [
      { label: "节点化资本开支", type: "leading", description: "拆分先进逻辑、存储、成熟制程与封装投入。", interpretation: "节点结构比总额更能映射到不同设备和材料公司的收入。" },
      { label: "设备积压与取消", type: "confirming", description: "观察订单覆盖期、交付调整和取消情况。", interpretation: "积压持续并按期转收入，才确认资本预算进入设备端。" },
      { label: "产能利用率", type: "confirming", description: "结合晶圆出货、价格和产品结构判断。", interpretation: "利用率低位时继续扩产会加大折旧与价格压力。" },
      { label: "建设与补贴延迟", type: "risk", description: "跟踪许可、劳动力、补贴和设备出口限制。", interpretation: "地域项目的延期会改变设备收入确认和全球产能分布。" },
    ],
    scenarios: [
      { key: "accelerating", label: "投资上修", trigger: "先进节点需求强、利用率高，晶圆厂连续上调资本开支。", implications: ["长交期关键设备订单能见度提高", "厂务、材料和 EDA 需求同步受益", "需防范供应商交付能力限制实际进度"] },
      { key: "base", label: "结构轮动", trigger: "总资本开支稳定，但资金在逻辑、存储和地域之间重新分配。", implications: ["设备公司表现取决于产品组合而非行业总额", "成熟制程扩张趋于谨慎", "海外建厂成本与补贴成为利润变量"] },
      { key: "constrained", label: "产能过剩", trigger: "终端需求放缓、利用率下降，但既定项目仍释放产能。", implications: ["晶圆价格与毛利承压", "设备订单延后或分阶段交付", "折旧增长快于收入会压缩制造端利润"] },
    ],
    verification: ["资本开支上调来自价格上涨还是新增设备数量？", "设备积压订单是否包含可取消或延期项目？", "新增产能对应已验证客户需求还是政策驱动建设？"],
    newsKeywords: ["fab", "foundry", "capex", "process", "晶圆", "18A"],
  },
  {
    slug: "ai-infrastructure-capex",
    eyebrow: "基础设施",
    title: "AI 数据中心资本开支",
    summary: "服务器、交换机、光互连、电力和散热共同决定算力集群能否按时上线。",
    thesis: "数据中心的有效供给单位不是机房面积，而是能够按期取得电力、网络、散热并完成服务器部署的可用兆瓦。",
    question: "除了 GPU，新增资本开支还流向了哪里？",
    signals: ["云厂商资本开支", "网络升级周期", "电力与散热订单"],
    stages: ["ai-infrastructure", "design", "equipment-materials"],
    tone: "cyan",
    mechanism: [
      { label: "算力规划", description: "模型规模和业务需求确定集群目标与部署地区。" },
      { label: "资源锁定", description: "土地、电网接入、发电和长周期设备先于机房建设。" },
      { label: "系统交付", description: "服务器、交换机、光模块与液冷系统共同上架。" },
      { label: "可用容量", description: "验收、联网和利用率决定资本开支何时产生服务收入。" },
    ],
    indicators: [
      { label: "已签约可用兆瓦", type: "leading", description: "区分规划管线、建设中和已供电容量。", interpretation: "已取得电力并签约客户的容量比远期规划更有确定性。" },
      { label: "机柜功率与液冷渗透", type: "leading", description: "观察单柜功率密度和散热架构升级。", interpretation: "功率密度提高会增加配电、冷却和工程价值量。" },
      { label: "网络与服务器交付", type: "confirming", description: "跟踪高速交换、光互连和整机上架。", interpretation: "IT 设备到位并不等于可用算力，还需结合电力和验收进度。" },
      { label: "Time-to-power", type: "risk", description: "监测排队年限、并网许可与发电约束。", interpretation: "供电周期拉长会延迟芯片需求确认和云服务收入。" },
    ],
    scenarios: [
      { key: "accelerating", label: "建设提速", trigger: "电力、土地和设备同时锁定，云厂商扩大长期容量承诺。", implications: ["资本开支从芯片扩散到网络、电力、冷却和工程", "可用容量稀缺支撑长期合同", "供应链执行成为比规划规模更重要的差异化因素"] },
      { key: "base", label: "瓶颈迁移", trigger: "服务器供应改善，但电网与建设周期仍限制上线速度。", implications: ["价值量向配电、发电和散热设备迁移", "不同地区的数据中心回报出现分化", "云厂商更重视算力利用率和调度效率"] },
      { key: "constrained", label: "上线延迟", trigger: "并网许可、发电设备或建设成本使项目延期。", implications: ["芯片与服务器订单可能推迟交付", "资本占用先发生而收入确认滞后", "缺乏确定电力的远期项目估值需要折价看待"] },
    ],
    verification: ["披露的容量是否已取得可靠电力和客户合同？", "资本开支有多少流向 IT 设备，多少流向土地与电力？", "新增服务器上线后的实际利用率和服务收入如何？"],
    newsKeywords: ["data center", "data centre", "electricity", "power", "数据中心", "电力", "cooling"],
  },
  {
    slug: "model-application-economics",
    eyebrow: "商业化",
    title: "模型与应用的单位经济",
    summary: "从模型调用成本、AI 产品定价到续费与使用深度，判断应用收入能否覆盖推理成本。",
    thesis: "AI 产品的长期价值取决于用户愿意持续付费的业务结果，而不是功能上线数量；收入、使用深度、推理成本和留存必须一起看。",
    question: "AI 功能是在创造新增收入，还是只增加成本？",
    signals: ["AI 产品收入", "推理成本", "付费渗透与留存"],
    stages: ["models-platforms", "ai-applications", "ai-infrastructure"],
    tone: "violet",
    mechanism: [
      { label: "能力供给", description: "模型质量、延迟和工具调用决定可解决的任务。" },
      { label: "产品嵌入", description: "AI 进入工作流并改变用户完成任务的方式。" },
      { label: "使用变现", description: "席位、用量或结果定价把使用深度转化为收入。" },
      { label: "单位利润", description: "收入扣除推理、数据和人工审核成本后形成贡献利润。" },
    ],
    indicators: [
      { label: "AI 付费渗透率", type: "leading", description: "区分试用、捆绑和真正增购。", interpretation: "独立付费和升级率比免费功能使用量更能验证支付意愿。" },
      { label: "使用深度与留存", type: "confirming", description: "跟踪活跃用户、任务频次与续费。", interpretation: "高频进入核心工作流才更可能形成稳定收入。" },
      { label: "推理贡献毛利", type: "confirming", description: "结合模型成本、价格和缓存优化判断。", interpretation: "单位成本下降只有在价格和使用量稳定时才改善利润。" },
      { label: "人工替代与错误成本", type: "risk", description: "关注审核、返工、合规和责任成本。", interpretation: "若错误成本高于效率收益，使用量增长也未必产生正向单位经济。" },
    ],
    scenarios: [
      { key: "accelerating", label: "商业化加速", trigger: "付费渗透、使用频次与贡献毛利同时改善。", implications: ["应用层从功能附加转向独立收入来源", "模型与基础设施成本下降释放利润空间", "掌握工作流和专有数据的平台更具黏性"] },
      { key: "base", label: "价值分化", trigger: "部分场景高频付费，其余功能仍以捆绑和试用为主。", implications: ["收入集中在少数可量化业务结果的场景", "通用功能价格竞争加剧", "厂商需要在增长与推理成本之间持续优化"] },
      { key: "constrained", label: "成本倒挂", trigger: "使用增长但付费、留存或单位毛利未改善。", implications: ["AI 功能成为留存成本而非新增收入", "模型调用可能转向更便宜的供应商或自研方案", "错误、合规与人工审核成本压缩经济价值"] },
    ],
    verification: ["AI 收入是新增付费、套餐涨价还是原有收入重新分类？", "活跃使用是否集中在少量重度用户？", "推理成本下降后，价格竞争是否同步侵蚀收益？"],
    newsKeywords: ["enterprise AI", "productivity", "agent", "application", "企业", "生产率", "模型"],
  },
];
