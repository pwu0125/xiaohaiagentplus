import type {
  StreamEvent,
  BookmarkOut,
  BookmarkListResponse,
  AgentInfo,
  AgentDiscussResponse,
  AgentDiscussResult,
  MaterialStreamEvent,
  AIProductReport,
  KnowledgeAnalysisItem,
  ReitResult,
  ReitDetail,
  PricePoint,
  BenchmarkData,
  ReitsDashboardData,
} from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const axios: any;

const API_BASE = import.meta.env.VITE_API_BASE || '';
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

export type { StreamEvent, MaterialStreamEvent, AIProductReport, KnowledgeAnalysisItem };

// 流式分析函数 - 使用SSE
export async function analyzeProjectStream(
  files: File[],
  projectType: string,
  selectedDepts: string[],
  selectedMasters: string[] = [],
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void
): Promise<void> {
  try {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('project_type', projectType);
    formData.append('selected_departments', selectedDepts.join(','));
    formData.append('selected_masters', selectedMasters.join(','));

    const response = await fetch(`${API_BASE}/api/analyze/stream`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') {
            onComplete?.();
            return;
          }
          try {
            const event: StreamEvent = JSON.parse(dataStr);
            onEvent(event);
            if (event.type === 'flow_complete') {
              onComplete?.();
              return;
            }
            if (event.type === 'error') {
              onError?.(new Error(event.error || 'Unknown error'));
              return;
            }
          } catch {
            // ignore parse error
          }
        }
      }
    }

    onComplete?.();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    onError?.(err);
  }
}

// 向后兼容的非流式API
export async function analyzeProject(
  files: File[],
  projectType: string,
  selectedDepts?: string[],
  selectedMasters?: string[]
): Promise<{ success: boolean; session_id: string; result: any }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  formData.append('project_type', projectType);
  if (selectedDepts && selectedDepts.length > 0) {
    formData.append('selected_departments', selectedDepts.join(','));
  }
  if (selectedMasters && selectedMasters.length > 0) {
    formData.append('selected_masters', selectedMasters.join(','));
  }

  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// 查询状态
export async function getSessionStatus(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/status/${sessionId}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function listBookmarks(
  params: {
    page?: number;
    page_size?: number;
    bookmark_type?: string;
    tags?: string[];
  } = {}
): Promise<BookmarkListResponse> {
  if (USE_MOCK) {
    // 按标签过滤
    let items = [...MOCK_BOOKMARKS];
    if (params.tags && params.tags.length > 0) {
      items = items.filter((item) => params.tags!.some((t) => item.tags.includes(t)));
    }
    if (params.bookmark_type) {
      items = items.filter((item) => item.bookmark_type === params.bookmark_type);
    }
    const page = params.page || 1;
    const page_size = params.page_size || 20;
    const start = (page - 1) * page_size;
    const end = start + page_size;
    return {
      items: items.slice(start, end),
      total: items.length,
      page,
      page_size,
    };
  }

  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.page_size) query.set('page_size', params.page_size.toString());
  if (params.bookmark_type) query.set('bookmark_type', params.bookmark_type);
  if (params.tags && params.tags.length > 0) query.set('tags', params.tags.join(','));

  const response = await fetch(`${API_BASE}/api/knowledge/bookmarks?${query.toString()}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function getAllTags(): Promise<{ tags: string[] }> {
  if (USE_MOCK) {
    const tagSet = new Set<string>();
    MOCK_BOOKMARKS.forEach((item) => item.tags.forEach((t) => tagSet.add(t)));
    return { tags: Array.from(tagSet).sort() };
  }

  const response = await fetch(`${API_BASE}/api/knowledge/tags`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function searchBookmarks(
  keyword: string,
  tags?: string[]
): Promise<{ results: BookmarkOut[]; count: number }> {
  if (USE_MOCK) {
    const lowerKeyword = keyword.toLowerCase();
    let results = MOCK_BOOKMARKS.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerKeyword) ||
        (item.content && item.content.toLowerCase().includes(lowerKeyword)) ||
        item.tags.some((t) => t.toLowerCase().includes(lowerKeyword))
    );
    if (tags && tags.length > 0) {
      results = results.filter((item) => tags.some((t) => item.tags.includes(t)));
    }
    return { results, count: results.length };
  }

  const payload: { keyword: string; tags?: string[] } = { keyword };
  if (tags && tags.length > 0) {
    payload.tags = tags;
  }

  const response = await fetch(`${API_BASE}/api/knowledge/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function listAgents(): Promise<{ agents: AgentInfo[]; total: number }> {
  if (USE_MOCK) {
    return {
      agents: [
        { id: 'buffett', name: '沃伦·巴菲特', subtitle: '安全边际 · 护城河 · 能力圈' },
        { id: 'munger', name: '查理·芒格', subtitle: '多元思维 · 逆向思考' },
        { id: 'graham', name: '本杰明·格雷厄姆', subtitle: '安全边际 · 内在价值' },
        { id: 'lynch', name: '彼得·林奇', subtitle: '十倍股 · 身边调研' },
        { id: 'greenblatt', name: '乔尔·格林布拉特', subtitle: '神奇公式 · 资本收益率' },
        { id: 'dreman', name: '大卫·德雷曼', subtitle: '逆向操作 · 心理偏误套利' },
        { id: 'duan', name: '段永平', subtitle: '本分文化 · 长期主义' },
        { id: 'trump', name: '唐纳德·特朗普', subtitle: '交易的艺术 · 品牌杠杆' },
        { id: 'rogers', name: '约翰·罗杰斯', subtitle: '乌龟哲学 · 中小盘' },
        { id: 'friess', name: '福斯特·弗里斯', subtitle: '盈利加速 · 质量过滤' },
        { id: 'okumus', name: '阿梅特·奥库穆斯', subtitle: '极致集中 · 安全边际' },
        { id: 'yacktman', name: '唐纳德·亚克特曼', subtitle: 'GALP · 前瞻收益率' },
      ],
      total: 12,
    };
  }

  const response = await fetch(`${API_BASE}/api/agents`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function discussWithAgents(
  topic: string,
  agentIds: string[],
  context?: string,
  onResult?: (result: AgentDiscussResult) => void,
): Promise<AgentDiscussResponse> {
  if (USE_MOCK) {
    // 模拟讨论延迟 - 逐个返回
    const results: AgentDiscussResult[] = [];

    for (const agentId of agentIds) {
      await delay(800 + Math.random() * 600); // 每条回复 800-1400ms 延迟

      const result = generateMockDiscussion(agentId, topic, context);
      results.push(result);

      // 如果有回调，逐条通知
      if (onResult) {
        onResult(result);
      }
    }

    return { topic, results, total: results.length };
  }

  const payload = { topic, agent_ids: agentIds, context };
  const response = await fetch(`${API_BASE}/api/agents/discuss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP error! status: ${response.status} ${detail}`);
  }
  return response.json();
}

// Mock版本 - 模拟SSE事件序列
export async function analyzeProjectStreamMock(
  _files: File[],
  _projectType: string,
  selectedDepts: string[],
  _selectedMasters: string[] = [],
  onEvent: (event: StreamEvent) => void,
  _onError?: (error: Error) => void,
  onComplete?: () => void
): Promise<void> {
  // 完整的9部门mock事件
  const allEvents: StreamEvent[] = [
    { type: 'stage_start', stage: 'secretary' },
    { type: 'stage_progress', stage: 'secretary', progress: 0.2 },
    { type: 'stage_progress', stage: 'secretary', progress: 0.5 },
    { type: 'stage_progress', stage: 'secretary', progress: 0.8 },
    {
      type: 'stage_complete',
      stage: 'secretary',
      result: {
        project_name: '上海环球港商业综合体',
        extracted_fields: {
          basic_info: {
            project_name: '上海环球港商业综合体',
            location: '上海市普陀区',
            developer: '月星集团',
            total_area: '480000平方米',
          },
          financial_data: {
            total_investment: '120亿元',
            expected_return: '8.5%',
            payback_period: '12年',
          },
          operational_data: {
            retail_area: '320000平方米',
            office_area: '100000平方米',
            hotel_area: '60000平方米',
          },
          market_context: {
            target_market: '长三角消费群',
            competitors: ['正大广场', '港汇恒隆', '环球金融中心'],
            market_growth: '6.8%年增长率',
          },
        },
        missing_fields: ['详细租金方案', '入驻品牌清单'],
        material_summary:
          '上海环球港是一座超大型商业综合体，位于上海市普陀区中山北路，总建筑面积48万平方米，集商业、办公、酒店、展览等功能于一体。',
        structured_content:
          '项目概况：上海环球港位于上海市普陀区中山北路3300号，是由月星集团投资开发的超大型城市综合体。项目总建筑面积约48万平方米，其中商业面积32万平方米，办公面积10万平方米，酒店面积6万平方米。项目总投资约120亿元人民币，预计投资回收期12年，预期年化回报率8.5%。项目定位服务长三角消费群，主要竞争对手包括正大广场、港汇恒隆和环球金融中心。所处市场年增长率约6.8%。',
      },
    },
    { type: 'stage_start', stage: 'departments' },
    // 9个部门依次启动
    { type: 'department_started', department: 'investment' },
    { type: 'department_started', department: 'asset_management' },
    { type: 'department_started', department: 'market' },
    { type: 'department_started', department: 'operation' },
    { type: 'department_started', department: 'financial' },
    { type: 'department_started', department: 'design' },
    { type: 'department_started', department: 'engineering' },
    { type: 'department_started', department: 'cost' },
    { type: 'department_started', department: 'legal' },
    // 9个部门依次完成
    {
      type: 'department_complete',
      department: 'investment',
      result: {
        department: 'investment',
        investment_summary:
          '项目总投资120亿元，预期IRR 11.2%，NPV 18.6亿元。投资结构合理，股权占比45%，债权占比55%。',
        capital_structure: {
          equity_ratio: '45%',
          debt_ratio: '55%',
          debt_cost: '5.2%',
          wacc: '7.8%',
        },
        return_analysis: {
          irr: '11.2%',
          npv: '18.6亿元',
          payback_period: '12年',
          roi: '8.5%',
        },
        score: 80,
      },
    },
    {
      type: 'department_complete',
      department: 'asset_management',
      result: {
        department: 'asset_management',
        asset_valuation:
          '项目资产评估值约138.6亿元，资产增值潜力良好。周边土地价值年增长率约6-8%，项目处于核心位置。',
        tenant_mix_analysis:
          '当前租户结构以零售为主（67%），办公为辅（21%），酒店占12%。建议优化租户组合，引入更多体验型业态。',
        operational_efficiency: {
          occupancy_rate: '92%',
          rent_collection_rate: '98%',
          operating_margin: '62%',
          tenant_retention: '85%',
        },
        score: 76,
      },
    },
    {
      type: 'department_complete',
      department: 'market',
      result: {
        department: 'market',
        market_overview:
          '上海商业地产市场整体稳定，普陀区作为连接长三角的重要节点，具有显著的区位优势。项目周边3公里范围内常住人口超过80万，日均人流量约30万人次。',
        competitive_landscape:
          '主要竞争对手包括正大广场（距离3.2km，32万㎡）、港汇恒隆（距离4.5km，25万㎡）、环球金融中心（距离5.8km，45万㎡）。环球港在规模上具有优势，但品牌定位略低于恒隆。',
        demand_analysis:
          '区域内缺乏大型一站式购物中心，消费需求旺盛。周边住宅入住率超过90%，办公人口约15万。地铁3、4、13号线交汇，交通便利性极佳。',
        pricing_trends:
          '区域内优质商铺租金保持在15-25元/㎡/天，年增长率约3-5%。办公租金约5-8元/㎡/天，酒店平均房价约600-800元/晚。',
        key_risks_opportunities: [
          '机会：地铁交汇带来巨大客流',
          '机会：区域内缺乏直接竞争的大型综合体',
          '风险：电商冲击传统零售',
          '风险：周边新商业项目潜在竞争',
        ],
        score: 78,
      },
    },
    {
      type: 'department_complete',
      department: 'operation',
      result: {
        department: 'operation',
        operation_model:
          '项目采用自营与外包结合的运营模式，物业管理由专业团队负责，运营效率处于行业领先水平。',
        management_team:
          '核心管理团队平均从业经验15年，拥有丰富的大型商业综合体运营经验。近3年团队稳定性良好。',
        service_quality: {
          customer_satisfaction: '4.5/5',
          complaint_rate: '0.8%',
          response_time: '平均2小时',
          service_diversity: '98项服务',
        },
        score: 82,
      },
    },
    {
      type: 'department_complete',
      department: 'financial',
      result: {
        department: 'financial',
        revenue_projections: {
          year1: '12.5亿元',
          year3: '15.8亿元',
          year5: '18.2亿元',
          year10: '22.6亿元',
        },
        cost_structure: {
          construction: '72亿元',
          land_acquisition: '28亿元',
          operating_cost: '3.2亿元/年',
          marketing: '0.8亿元/年',
        },
        profitability_analysis: {
          gross_margin: '62%',
          net_margin: '28%',
          roi: '8.5%',
          irr: '11.2%',
        },
        cash_flow_assessment: {
          payback_period: '12年',
          break_even_occupancy: '65%',
          cash_flow_positive: '第4年',
        },
        key_metrics: {
          npv: '18.6亿元',
          dcf_valuation: '138.6亿元',
          debt_service_coverage: '1.35x',
          loan_to_value: '55%',
        },
        score: 82,
      },
    },
    {
      type: 'department_complete',
      department: 'design',
      result: {
        department: 'design',
        space_planning:
          '项目空间布局合理，动线设计流畅。商业、办公、酒店三大业态分区明确，共享空间设计充分利用。',
        circulation_design:
          '人行动线采用环形设计，核心中庭贯穿地下2层至地上6层，垂直交通设置合理，平均换乘时间不超过3分钟。',
        user_experience: {
          accessibility: '无障碍覆盖率98%',
          parking_ratio: '1.2个/100㎡',
          green_space: '绿化率25%',
          public_area: '公共空间占比35%',
        },
        score: 75,
      },
    },
    {
      type: 'department_complete',
      department: 'engineering',
      result: {
        department: 'engineering',
        construction_feasibility:
          '项目主体结构已完工并通过验收，建筑质量符合国家标准。剩余工程量主要集中在内部装修和设备安装。',
        technical_solution:
          '采用框剪结构体系，抗震设防烈度7度。机电系统采用智能化控制，BIM技术全程应用于施工管理。',
        schedule_assessment: {
          overall_progress: '85%',
          remaining_duration: '预计12个月',
          key_milestones: '3个关键节点',
          risk_level: '低',
        },
        score: 88,
      },
    },
    {
      type: 'department_complete',
      department: 'cost',
      result: {
        department: 'cost',
        construction_cost:
          '项目单位建设成本约15000元/㎡，处于上海同类项目中等偏上水平。主要成本项为结构工程（45%）和机电工程（25%）。',
        operating_cost:
          '年度运营成本约3.2亿元，其中人力成本占35%，能源成本占20%，维护成本占15%，其他占30%。单位运营成本约667元/㎡/年。',
        cost_optimization: {
          potential_savings: '预计可优化8-12%',
          energy_efficiency: '节能改造可降耗15%',
          smart_management: '数字化管理可降本10%',
        },
        score: 72,
      },
    },
    {
      type: 'department_complete',
      department: 'legal',
      result: {
        department: 'legal',
        legal_compliance:
          '项目已取得建设用地规划许可证、建设工程规划许可证和施工许可证。环保评估通过，消防设计审核合格。',
        contract_risk:
          '主要合同风险包括总包合同中的工期延误条款、设备采购合同中的交付条款，以及租赁合同中的租金调整条款。',
        property_rights: {
          land_certificate: '土地证已取得',
          building_ownership: '房产证办理中',
          mortgage_status: '部分抵押给银行',
          dispute_history: '无重大产权纠纷',
        },
        score: 85,
      },
    },
    {
      type: 'stage_complete',
      stage: 'departments',
      result: {
        department_scores: {
          investment: 80,
          asset_management: 76,
          market: 78,
          operation: 82,
          financial: 82,
          design: 75,
          engineering: 88,
          cost: 72,
          legal: 85,
        },
        summary: '各部门分析完成',
      },
    },
    { type: 'stage_start', stage: 'master_skill' },
    {
      type: 'stage_complete',
      stage: 'master_skill',
      result: {
        skill_name: '投资大师视角',
        key_insights: [
          '项目规模效应显著，48万㎡的超大体量在区域内形成进入壁垒',
          '三轨交汇的交通优势是不可复制的核心竞争力',
          '财务模型显示第4年转正现金流，12年回收期处于合理区间',
          '工程进度已达85%，风险可控，预计12个月可全部完工',
          '法律合规完备，产权清晰，无重大法律风险',
        ],
        critical_questions: [
          '如果周边3公里内再建同类综合体，项目的差异化优势在哪？',
          '当前65%的盈亏平衡入住率是否合理可实现？',
          '电商冲击下，32万㎡零售面积的定位是否需要调整？',
          '成本控制方面还有多大优化空间？',
        ],
        cross_department_analysis:
          '市场部门和财务部门的分析结果高度一致：项目具有区位和规模优势，但面临竞争和电商的双重挑战。工程部门评估项目进度已达85%，风险较低，与成本部门的分析形成呼应。法律部门确认合规完备，为投资决策提供了坚实的法律保障。建议适当降低杠杆率，增加长期租约比例，同时推进成本优化措施。',
        additional_analysis:
          '从投资组合角度看，该项目适合作为核心型（Core Plus）资产持有。建议分阶段开发，先启动零售和办公部分，酒店部分视市场情况择机推出。同时考虑引入REITs退出机制，增强流动性。',
        strategic_recommendations: [
          '优先引入国际知名主力店作为锚店',
          '考虑"商业+文化+体验"的差异化定位',
          '建立数字化运营平台提升租户管理效率',
          '预留10-15%的面积用于灵活调整业态',
          '推进节能改造降低运营成本',
        ],
      },
    },
    { type: 'stage_start', stage: 'decision_maker' },
    {
      type: 'stage_complete',
      stage: 'decision_maker',
      result: {
        typed_conclusion: '投',
        rating: 'B+',
        score: 80,
        summary:
          '上海环球港商业综合体项目整体评估为"投"。项目具备显著的区位优势和规模效应，48万㎡超大体量配合三轨交汇交通优势形成强大的竞争壁垒。9个部门综合评分平均80分，其中工程分析（88分）和法律分析（85分）表现突出，运营分析（82分）和财务建模（82分）稳健。投资模型显示预期IRR 11.2%，第4年实现正现金流，投资回收期12年处于合理区间。主要风险来自市场竞争加剧和成本优化空间，但通过签订长期租约、建立租户储备库等措施可有效缓释。',
        key_metrics: {
          综合评分: 80,
          投资评级: 'B+',
          预期IRR: '11.2%',
          NPV: '18.6亿元',
          回收期: '12年',
          盈亏平衡入住率: '65%',
        },
        risks: [
          { type: '市场风险', level: '中等', description: '商业地产市场波动' },
          { type: '竞争风险', level: '中高', description: '周边新建商业项目分流' },
          { type: '成本风险', level: '中等', description: '运营成本优化空间有限' },
          { type: '运营风险', level: '中低', description: '大型综合体管理复杂度' },
          { type: '财务风险', level: '中等', description: '利率敏感性较高' },
        ],
        recommendations: [
          '优先引入国际知名主力店作为锚店，提升项目定位',
          '签订长期租约锁定优质租户，降低空置风险',
          '采用利率互换工具对冲利率风险',
          '建立数字化运营平台提升管理效率',
          '考虑分阶段开发，酒店部分择机推出',
          '预留10-15%面积用于灵活调整业态',
          '推进节能改造降低运营成本8-12%',
        ],
        department_scores: {
          investment: 80,
          asset_management: 76,
          market: 78,
          operation: 82,
          financial: 82,
          design: 75,
          engineering: 88,
          cost: 72,
          legal: 85,
        },
        final_assessment:
          '综合考虑项目的区位优势、规模效应、财务表现和风险因素，建议投资该项目。项目符合"核心增值型"投资标准，预期能提供稳定的现金流回报和长期增值潜力。建议控制杠杆率不超过55%，并在运营中重点关注租户结构和业态优化。',
      },
    },
    { type: 'flow_complete' },
  ];

  // 过滤：只保留 secretary + 选中部门 + master_skill + decision_maker
  const filteredEvents = allEvents.filter((event) => {
    if (event.type === 'department_started' || event.type === 'department_complete') {
      return selectedDepts.includes(event.department || '');
    }
    return true;
  });

  // 对decision_maker的结果进行部门评分过滤
  const decisionCompleteEvent = filteredEvents.find(
    (e) => e.type === 'stage_complete' && e.stage === 'decision_maker'
  );
  if (decisionCompleteEvent?.result?.department_scores) {
    const filteredScores: Record<string, number> = {};
    for (const [dept, score] of Object.entries(decisionCompleteEvent.result.department_scores)) {
      if (selectedDepts.includes(dept)) {
        filteredScores[dept] = score as number;
      }
    }
    decisionCompleteEvent.result.department_scores = filteredScores;
  }

  // 同样过滤departments stage_complete中的department_scores
  const deptsCompleteEvent = filteredEvents.find(
    (e) => e.type === 'stage_complete' && e.stage === 'departments'
  );
  if (deptsCompleteEvent?.result?.department_scores) {
    const filteredScores: Record<string, number> = {};
    for (const [dept, score] of Object.entries(deptsCompleteEvent.result.department_scores)) {
      if (selectedDepts.includes(dept)) {
        filteredScores[dept] = score as number;
      }
    }
    deptsCompleteEvent.result.department_scores = filteredScores;
  }

  for (const event of filteredEvents) {
    onEvent(event);
    // 不同阶段不同延迟
    if (event.type === 'stage_start' || event.type === 'stage_complete') {
      await delay(600);
    } else if (event.type === 'department_started' || event.type === 'department_complete') {
      await delay(400);
    } else if (event.type === 'stage_progress') {
      await delay(300);
    } else if (event.type === 'flow_complete') {
      await delay(500);
    }
  }

  onComplete?.();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 统一入口 - 根据USE_MOCK自动选择
export async function analyzeProjectStreamAuto(
  files: File[],
  projectType: string,
  selectedDepts: string[],
  _selectedMasters: string[] = [],
  onEvent: (event: StreamEvent) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void
): Promise<void> {
  if (USE_MOCK) {
    return analyzeProjectStreamMock(files, projectType, selectedDepts, _selectedMasters, onEvent, onError, onComplete);
  }
  return analyzeProjectStream(files, projectType, selectedDepts, _selectedMasters, onEvent, onError, onComplete);
}

// ===== 材料分析 API =====

export async function analyzeMaterialStream(
  files: File[],
  projectType: string,
  onEvent: (event: MaterialStreamEvent) => void,
  _onError?: (error: Error) => void,
): Promise<void> {
  // Mock 模式：模拟SSE流式事件
  if (USE_MOCK) {
    const sessionId = crypto.randomUUID();
    [
      { id: 'extraction', label: '文件提取' },
      { id: 'secretary', label: '秘书处理' },
      { id: 'report_builder', label: '报告生成' },
    ];

    onEvent({ type: 'stage_start', stage: 'extraction', session_id: sessionId });
    await delay(800);
    onEvent({ type: 'stage_progress', stage: 'extraction', progress: 30, session_id: sessionId });
    await delay(600);
    onEvent({ type: 'stage_progress', stage: 'extraction', progress: 60, session_id: sessionId });
    await delay(600);
    onEvent({ type: 'stage_progress', stage: 'extraction', progress: 100, session_id: sessionId });
    await delay(400);
    onEvent({ type: 'stage_complete', stage: 'extraction', session_id: sessionId });

    await delay(500);
    onEvent({ type: 'stage_start', stage: 'secretary', session_id: sessionId });
    await delay(1500);
    onEvent({ type: 'stage_complete', stage: 'secretary', session_id: sessionId });

    await delay(500);
    onEvent({ type: 'stage_start', stage: 'report_builder', session_id: sessionId });
    await delay(800);
    onEvent({ type: 'stage_progress', stage: 'report_builder', progress: 25, session_id: sessionId });
    await delay(600);
    onEvent({ type: 'stage_progress', stage: 'report_builder', progress: 50, session_id: sessionId });
    await delay(600);
    onEvent({ type: 'stage_progress', stage: 'report_builder', progress: 75, session_id: sessionId });
    await delay(600);
    onEvent({ type: 'stage_progress', stage: 'report_builder', progress: 100, session_id: sessionId });
    await delay(400);
    onEvent({ type: 'stage_complete', stage: 'report_builder', session_id: sessionId });

    await delay(500);
    onEvent({
      type: 'flow_complete',
      session_id: sessionId,
      final_report: {
        report: generateMockMaterialReport(),
        kb_id: `kb-${Date.now()}`,
      },
    });
    return;
  }

  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('project_type', projectType);

  const response = await fetch(`${API_BASE}/api/analyze/material/stream`, {
    method: 'POST',
    body: formData,
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event = JSON.parse(line.slice(6)) as MaterialStreamEvent;
          onEvent(event);
          if (event.type === 'flow_complete' || event.type === 'error') {
            return;
          }
        } catch (e) {
          console.warn('Parse SSE event failed:', line);
        }
      }
    }
  }
}

export async function analyzeMaterial(
  files: File[],
  projectType: string,
): Promise<{ success: boolean; session_id: string; result: AIProductReport; kb_id: string }> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  formData.append('project_type', projectType);

  const { data } = await axios.post(`${API_BASE}/api/analyze/material`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

// ===== 知识库分析材料 API =====

export async function listAnalysisMaterials(
  analysisType?: 'ai-product' | 'committee',
): Promise<{ items: KnowledgeAnalysisItem[]; total: number }> {
  if (USE_MOCK) {
    return { items: [], total: 0 };
  }
  const { data } = await axios.get(`${API_BASE}/api/knowledge/analysis`, {
    params: analysisType ? { analysis_type: analysisType } : undefined,
  });
  return data;
}

export async function getAnalysisMaterial(id: string): Promise<KnowledgeAnalysisItem> {
  if (USE_MOCK) throw new Error('Not implemented in mock mode');
  const { data } = await axios.get(`${API_BASE}/api/knowledge/analysis/${id}`);
  return data;
}

export async function searchAnalysisMaterials(
  keyword: string,
  analysisType?: 'ai-product' | 'committee',
): Promise<{ results: KnowledgeAnalysisItem[]; count: number }> {
  if (USE_MOCK) return { results: [], count: 0 };
  const { data } = await axios.post(`${API_BASE}/api/knowledge/analysis/search`, {
    keyword,
    analysis_type: analysisType,
  });
  return data;
}

// ===== COB-REval 不动产估值 API =====

export async function fetchReitsSearch(query: string): Promise<ReitResult[]> {
  try {
    const response = await fetch(`${API_BASE}/api/reits/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('fetchReitsSearch failed:', error);
    throw error;
  }
}

export async function fetchReitsDetail(code: string): Promise<ReitDetail> {
  try {
    const response = await fetch(`${API_BASE}/api/reits/${encodeURIComponent(code)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    console.error('fetchReitsDetail failed:', error);
    throw error;
  }
}

export async function fetchReitsPrice(code: string): Promise<PricePoint[]> {
  try {
    const response = await fetch(`${API_BASE}/api/reits/price/${encodeURIComponent(code)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    console.error('fetchReitsPrice failed:', error);
    throw error;
  }
}

export async function fetchCReitsIndex(): Promise<{date: string; index: number}[]> {
  const response = await fetch(`${API_BASE}/api/reits/c-reits-index`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function fetchBenchmark(): Promise<BenchmarkData> {
  try {
    const response = await fetch(`${API_BASE}/api/benchmark`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  } catch (error) {
    console.error('fetchBenchmark failed:', error);
    throw error;
  }
}

export async function fetchReitsDashboard(): Promise<ReitsDashboardData> {
  const response = await fetch(`${API_BASE}/api/reits/dashboard`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function generateMockDiscussion(
  agentId: string,
  topic: string,
  _context?: string
): AgentDiscussResult {
  const now = new Date().toISOString();

  const agentData: Record<string, { name: string; subtitle: string; style: string }> = {
    buffett: { name: '沃伦·巴菲特', subtitle: '安全边际 · 护城河 · 能力圈', style: '价值' },
    munger: { name: '查理·芒格', subtitle: '多元思维 · 逆向思考', style: '逆向' },
    graham: { name: '本杰明·格雷厄姆', subtitle: '安全边际 · 内在价值', style: '价值' },
    lynch: { name: '彼得·林奇', subtitle: '十倍股 · 身边调研', style: '成长' },
    greenblatt: { name: '乔尔·格林布拉特', subtitle: '神奇公式 · 资本收益率', style: '量化价值' },
    dreman: { name: '大卫·德雷曼', subtitle: '逆向操作 · 心理偏误套利', style: '逆向' },
    duan: { name: '段永平', subtitle: '本分文化 · 长期主义', style: '长期价值' },
    trump: { name: '唐纳德·特朗普', subtitle: '交易的艺术 · 品牌杠杆', style: '交易' },
    rogers: { name: '约翰·罗杰斯', subtitle: '乌龟哲学 · 中小盘', style: '耐心成长' },
    friess: { name: '福斯特·弗里斯', subtitle: '盈利加速 · 质量过滤', style: '质量成长' },
    okumus: { name: '阿梅特·奥库穆斯', subtitle: '极致集中 · 安全边际', style: '集中价值' },
    yacktman: { name: '唐纳德·亚克特曼', subtitle: 'GALP · 前瞻收益率', style: '收益' },
  };

  const agent = agentData[agentId] || { name: agentId, subtitle: '投资大师', style: '价值' };

  // 根据话题生成不同回复
  const responses: Record<string, string[]> = {
    buffett: [
      `从价值投资的角度看，我们需要关注这家企业是否拥有持久的竞争优势（护城河）。如果它能在未来10年持续产生稳定的自由现金流，且当前价格低于内在价值，那就是一个值得考虑的机会。记住，价格是你付出的，价值是你得到的。`,
      `我更关注企业的长期竞争力而非短期市场波动。如果这家公司的ROE能持续保持在15%以上，并且管理层诚信能干，那么时间会成为我们的朋友。不要被市场的噪音干扰。`,
      `安全边际始终是第一位的。即使在看好一个项目时，也要确保有足够的安全边际。我倾向于那些在行业中占据主导地位、拥有定价权的企业。`,
    ],
    munger: [
      `告诉我这个投资会失败的所有原因，我就会知道如何避免它们。多元思维模型是关键——你需要从经济学、心理学、数学等多个角度审视这个机会。如果它通过了所有考验，那才值得考虑。`,
      `人类的心理偏误是投资中最大的敌人。确认偏误、损失厌恶、羊群效应——你必须清醒地认识这些陷阱。一个伟大的投资机会往往是反直觉的。`,
      `简单化，但不要过于简单。找到那些你真正理解的企业，在自己的能力圈内行动。跨界学习能让你看到别人看不到的东西。`,
    ],
    graham: [
      `安全边际是投资中唯一不可妥协的原则。即使你的分析完全正确，市场也可能长期不认可你的判断。只有当价格远低于内在价值时，才是真正的投资机会。`,
      `市场先生每天都会报出一个价格，但他经常是不理性的。你的任务不是预测他的情绪，而是利用他的情绪。当市场恐慌时买入，当市场贪婪时卖出。`,
      `投资必须经过彻底的分析，确保本金安全，并获得满意的回报。任何不符合这三个条件的操作都是投机，而非投资。`,
    ],
    lynch: [
      `投资你了解的领域！如果你在日常生活中发现了一家好公司——比如你的孩子突然爱上某个品牌，或者某个商场总是人满为患——那就是你的研究起点。散户也有优势，因为你比华尔街更早发现趋势。`,
      `我寻找的是十倍股——那些能在几年内翻十倍的股票。它们通常隐藏在不起眼的行业中：零售业、服务业、甚至是殡仪馆。关键是找到那些增长快速但还没被发现的gems。`,
      `不要被宏大叙事迷惑。真正的好公司往往是那些做简单生意、名字 boring 但业务蒸蒸日上的企业。调研要深入一线，和店员、顾客聊天，这比读研报更有价值。`,
    ],
    greenblatt: [
      `神奇公式的核心很简单：买好公司，便宜买。高资本收益率（ROC）代表好生意，高盈利收益率（EY）代表好价格。两者结合，长期跑市场不是问题。`,
      `量化筛选能帮你避免情绪干扰。设定清晰的规则，机械执行，给时间让概率发挥作用。一年下来，神奇公式的组合通常能跑赢大多数主动管理基金。`,
      `不需要很复杂。找到ROC排名前20%、EY排名前20%的公司，组合投资，持有一年，然后轮换。简单，但有效。`,
    ],
    dreman: [
      `大众恐慌时买入，大众贪婪时卖出。这说起来容易做起来难，因为逆势而为需要极大的心理承受力。但历史反复证明，最受欢迎的股票往往回报最差，最被嫌弃的反而表现最好。`,
      `心理偏误套利的核心是利用市场参与者的系统性错误。过度反应、锚定效应、可得性偏误——这些都是你可以利用的漏洞。`,
      `不要被最近的表现迷惑。过去3年表现最差的股票组合，在未来3年往往反超表现最好的组合。这就是均值回归的力量。`,
    ],
    duan: [
      `本分就是做对的事情，把事情做对。做投资首先要明确自己的能力圈，不懂的不碰。很多人亏钱不是因为没机会，而是因为在不懂的领域瞎折腾。`,
      `快就是慢，慢就是快。真正好的投资机会不需要你急着做决定。如果你需要非常努力地说服自己投资，那大概率不是好机会。`,
      `企业文化至关重要。一个拥有"本分"文化的企业，即使在逆境中也能做出正确的决策。看管理层是否诚信、是否聚焦长期价值，这比看财务报表更重要。`,
    ],
    trump: [
      `这个位置的关键是location、location、location！同时要看品牌溢价能力——一个强大的品牌能让你的租金比别人高30%。Think big, 但更要think deal-making。`,
      `谈判是艺术。每一笔交易都要争取最好的条件——更长的免租期、更高的装修补贴、更有利的退出条款。好的交易结构能让一个普通项目变成赢家。`,
      `杠杆用得好是加速器，用不好是定时炸弹。我只在现金流确定能覆盖债务时才使用杠杆。Brand is power——永远不要低估品牌在商业地产中的价值。`,
    ],
    rogers: [
      `慢即是快。我是"乌龟"投资者，专注于被市场忽视的中小盘股。大公司已经被人研究透了，真正的超额收益往往藏在那些市值低于10亿美元的公司里。`,
      `耐心等待是关键。一个好机会可能需要几年时间才能成熟。在此期间，你需要做的是持续研究、持续跟踪，而不是频繁交易。`,
      `找到那些拥有稳固商业模式但暂时被市场冷落的公司。当市场重新认识它们的价值时，回报往往是惊人的。`,
    ],
    friess: [
      `追求盈利加速的公司。我寻找那些连续多个季度盈利增长超过20%的企业。盈利增长是股价上涨的最终驱动力。`,
      `质量过滤是第一道关卡。高ROE、低负债、稳定的现金流——只有通过了这些筛选的公司，才值得深入研究。`,
      `成长投资不是赌博。每一笔投资都要基于扎实的数据分析。如果一家公司连续8个季度超预期，那说明它的商业模式正在被验证。`,
    ],
    okumus: [
      `当确定性足够高时，重仓是唯一选择。我不做分散投资——我把大部分资金集中在少数几个我极度确信的机会上。`,
      `四维安全边际：低估值、强劲资产负债表、优秀管理层、清晰的增长路径。只有同时满足这四个条件，我才会考虑重仓。`,
      `大多数人太害怕集中投资了。但如果你真的深入研究了一个机会，理解了它的每一个风险点，并且价格提供了足够的安全边际，那么5-10只股票的组合远比50只股票的组合更安全。`,
    ],
    yacktman: [
      `前瞻性收益率（Forward Rate of Return）是我评估一切投资的核心指标。它告诉你，如果今天买入并持有，未来能获得什么样的回报。`,
      'GALP——Good Assets at Low Prices。找到那些拥有优质资产但价格低迷的公司。市场短期是投票机，长期会回归理性。',
      `不要被短期波动影响判断。一个真正好的投资，即使市场关闭5年你也应该安心持有。如果做不到这一点，说明你对这个投资的理解还不够。`,
    ],
  };

  const agentResponses = responses[agentId] || [
    `从${agent.style}投资的角度分析，这个话题涉及多个维度。建议深入研究企业的竞争优势和估值水平，在确保安全边际的前提下做出决策。`,
  ];

  // 根据topic选择不同的回复
  const responseIndex = Math.abs(topic.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % agentResponses.length;
  const content = agentResponses[responseIndex];

  return {
    agent_id: agentId,
    agent_name: agent.name,
    agent_subtitle: agent.subtitle,
    content,
    timestamp: now,
  };
}

// ===== Mock 知识库数据 =====

const MOCK_BOOKMARKS: BookmarkOut[] = [
  {
    id: 'kb-001',
    title: '上海环球港 — 材料分析报告',
    url: null,
    content:
      '项目类型：购物中心\n结论：改\n置信度：72%\n\n关键指标：\n- 估值：50.5亿元\n- Cap Rate：5.5%\n- IRR：9.8%\n- 年NOI：2.78亿元\n- 出租率：88%\n\n建议优先引入国际知名主力店作为锚店，优化业态组合增加体验式消费比例至35%。',
    tags: ['ai-product', '购物中心', '上海'],
    bookmark_type: 'note',
    created_at: '2026-06-10T14:32:00',
    updated_at: '2026-06-10T14:32:00',
  },
  {
    id: 'kb-002',
    title: '投决会汇总：北京CBD核心区甲级写字楼',
    url: null,
    content:
      '投决会结论：投 | 评级：A-\n\n各部门评分：\n- 投资部：92\n- 资管部：88\n- 市场部：85\n- 运营部：90\n- 财务部：87\n\n大师Skill共识：项目区位优势显著，长期持有价值高。巴菲特、芒格均给出正面评价。\n\n最终建议：积极推进投资，控制杠杆率不超过50%。',
    tags: ['committee', '写字楼', '北京'],
    bookmark_type: 'note',
    created_at: '2026-06-08T10:15:00',
    updated_at: '2026-06-08T10:15:00',
  },
  {
    id: 'kb-003',
    title: '深圳前海综合体 — 材料分析报告',
    url: null,
    content:
      '项目类型：城市综合体\n结论：投\n置信度：85%\n\n关键指标：\n- 估值：78亿元\n- Cap Rate：5.2%\n- IRR：12.5%\n- 年NOI：4.06亿元\n- 出租率：93%\n\n前海片区政策红利持续释放，三地铁交汇带来稳定客流。建议分阶段开发，酒店部分择机推出。',
    tags: ['ai-product', '城市综合体', '深圳'],
    bookmark_type: 'note',
    created_at: '2026-06-05T09:20:00',
    updated_at: '2026-06-05T09:20:00',
  },
  {
    id: 'kb-004',
    title: '投决会汇总：杭州西湖商圈购物中心',
    url: null,
    content:
      '投决会结论：改 | 评级：B+\n\n各部门评分：\n- 投资部：78\n- 资管部：72\n- 市场部：80\n- 运营部：75\n- 财务部：70\n\n大师Skill观点分歧：段永平建议"做好本分、优化运营后再投"，特朗普认为"位置极佳、值得压注"。\n\n最终建议：先行优化运营效率，6个月后重新评估。',
    tags: ['committee', '购物中心', '杭州'],
    bookmark_type: 'note',
    created_at: '2026-06-01T16:45:00',
    updated_at: '2026-06-01T16:45:00',
  },
  {
    id: 'kb-005',
    title: '投资策略笔记：安全边际原则',
    url: null,
    content:
      '格雷厄姆的安全边际原则是价值投资的基石。\n\n核心要点：\n1. 安全边际 = 内在价值 - 市场价格\n2. 只有当安全边际 > 30% 时才考虑投资\n3. 安全边际是对未来不确定性的缓冲\n4. 即使分析完全正确，也需要安全边际保护\n\n应用案例：\n- 上海环球港：安全边际25%，暂不投资\n- 北京CBD写字楼：安全边际35%，符合投资标准',
    tags: ['投资策略', '价值投资'],
    bookmark_type: 'note',
    created_at: '2026-05-28T11:00:00',
    updated_at: '2026-05-28T11:00:00',
  },
  {
    id: 'kb-006',
    title: 'REITs市场2026年中期展望',
    url: null,
    content:
      '2026年REITs市场整体表现稳健，底层资产质量持续改善。\n\n关键趋势：\n1. 产业园REITs受益于电商物流需求，出租率稳定在95%+\n2. 保障性租赁住房REITs政策支持力度加大\n3. 购物中心REITs分化明显，核心城市表现优于三四线\n\n重点关注标的：\n- 中金普洛斯REIT（物流园）\n- 华夏华润有巢REIT（长租公寓）\n- 嘉实京东仓储REIT（电商物流）',
    tags: ['REITs', '市场研究', '2026'],
    bookmark_type: 'note',
    created_at: '2026-06-12T08:30:00',
    updated_at: '2026-06-12T08:30:00',
  },
  {
    id: 'kb-007',
    title: '产业园区估值方法对比分析',
    url: null,
    content:
      '对比了收益法、市场法和成本法在产业园区估值中的应用。\n\n结论：\n- 收益法（DCF）：适合成熟运营园区，但对现金流预测敏感\n- 市场法（可比交易）：数据可得性好，但需调整差异\n- 成本法（重置成本）：适合新建园区，低估运营价值\n\n推荐：以收益法为主，市场法为辅，成本法作为底线验证。\n\nCap Rate参考区间：\n- 一线城市：5.0%-6.0%\n- 二线城市：6.0%-7.5%\n- 三线城市：7.5%-9.0%',
    tags: ['产业园区', '估值方法'],
    bookmark_type: 'note',
    created_at: '2026-05-20T13:10:00',
    updated_at: '2026-05-20T13:10:00',
  },
  {
    id: 'kb-008',
    title: '长租公寓运营关键指标体系',
    url: null,
    content:
      '建立了一套完整的长租公寓运营评估体系。\n\n核心KPI：\n1. NOI Margin：目标 > 55%\n2. RevPAR（每间可租房收入）：同比+3%\n3. 出租率：目标 > 92%\n4. 客户续约率：目标 > 65%\n5. 获客成本（CAC）：目标 < 月租金的50%\n6. OPEX占收入比：目标 < 35%\n\n对标对象：\n- 自如：出租率94%，NOI Margin 58%\n- 万科泊寓：出租率91%，NOI Margin 52%\n- 龙湖冠寓：出租率93%，NOI Margin 56%',
    tags: ['长租公寓', '运营指标'],
    bookmark_type: 'note',
    created_at: '2026-06-03T15:00:00',
    updated_at: '2026-06-03T15:00:00',
  },
  {
    id: 'kb-009',
    title: '宏观周期跟踪：2026年Q2商业地产市场',
    url: null,
    content:
      '宏观经济处于复苏期，商业地产市场呈现回暖态势。\n\n关键指标：\n- GDP增速：5.2%（同比持平）\n- 社零增速：7.8%（回升）\n- 商业空置率：9.2%（下降）\n- 租金指数：101.5（上升）\n- 资本化率：5.5%（平稳）\n\n行业周期判断：\n商业地产行业处于调整后期，核心城市优质资产的结构性机会显现。建议关注一线和强二线城市的核心商圈项目。',
    tags: ['宏观周期', '市场研究', '2026'],
    bookmark_type: 'note',
    created_at: '2026-06-14T09:00:00',
    updated_at: '2026-06-14T09:00:00',
  },
];

function generateMockMaterialReport(): AIProductReport {
  return {
    conclusion: '改',
    confidence: 72,
    summary: '建议对项目进行优化改良后再投资，当前基本面良好但运营效率有待提升。',
    sections: {
      overview: '<h3>项目概况</h3><p>该项目位于城市核心商圈，总建筑面积约12万平方米，包含商业、办公及配套功能。项目所在区域交通便捷，三条地铁线路交汇，日均客流量超过30万人次。</p>',
      financial: '<h3>财务分析</h3><p>项目年营业收入约4.8亿元，运营成本率约42%，NOI约2.78亿元。当前出租率88%，较市场平均90%略低，存在提升空间。</p>',
      valuation: '<h3>估值分析</h3><p>采用收益法估值，Cap Rate取5.5%，项目估值约50.5亿元。DCF模型显示项目内在价值48-53亿元区间。</p>',
      roi: '<h3>投资回报</h3><p>预计IRR 9.8%，投资回收期11年。现金回报率(Cash-on-Cash)约6.2%，处于行业中等水平。</p>',
      risk: '<h3>风险分析</h3><p>主要风险包括市场竞争加剧、电商冲击、利率波动等。建议通过引入主力品牌、优化业态组合来缓释风险。</p>',
    },
    key_metrics: {
      '估值': '50.5亿元',
      'Cap Rate': '5.5%',
      'IRR': '9.8%',
      '年NOI': '2.78亿元',
      '出租率': '88%',
      'DSCR': '1.28x',
      'LTV': '60%',
    },
    scenarios: {
      optimistic: { irr: '13.5%', roi: '10.2%', value: '58亿元', trigger: '出租率提升至95%以上，租金年增长4%' },
      base: { irr: '9.8%', roi: '7.5%', value: '50.5亿元', trigger: '出租率维持88-92%，租金年增长2-3%' },
      pessimistic: { irr: '6.2%', roi: '4.8%', value: '43亿元', trigger: '出租率下降至80%以下，租金停滞' },
    },
    risks: [
      { category: '市场风险', level: '中等', description: '商业地产市场波动，受宏观经济影响较大' },
      { category: '竞争风险', level: '中高', description: '周边新建商业项目可能分流客流' },
      { category: '运营风险', level: '中等', description: '大型综合体管理复杂度高，需要专业团队' },
      { category: '财务风险', level: '中等', description: '利率敏感性较高，需关注融资成本变化' },
    ],
    action_items: [
      '引入国际知名主力店作为锚店，提升项目定位',
      '优化业态组合，增加体验式消费比例至35%',
      '签订长期租约锁定优质租户，降低空置风险',
      '推进数字化运营，建立会员体系提升复购率',
      '考虑绿色节能改造，降低运营成本10-15%',
    ],
    project_profile: {
      name: '城市核心商业综合体',
      property_type: '商业综合体',
      location: '上海市核心区',
      total_area: '120000平方米',
      operational_status: '运营中',
    },
    macro_cycle: {
      phase: '复苏期',
      summary: '宏观经济处于复苏期，GDP增速回升，消费信心逐步恢复。',
      indicators: [
        { name: 'GDP增速', current: '5.2%', trend: '上升', points: [{ year: '2020', value: 2.3 }, { year: '2021', value: 8.1 }, { year: '2022', value: 3.0 }, { year: '2023', value: 5.2 }, { year: '2024', value: 5.2 }] },
        { name: '社零增速', current: '7.8%', trend: '上升', points: [{ year: '2020', value: -3.9 }, { year: '2021', value: 12.5 }, { year: '2022', value: -0.2 }, { year: '2023', value: 7.2 }, { year: '2024', value: 7.8 }] },
        { name: 'CPI', current: '0.8%', trend: '下降', points: [{ year: '2020', value: 2.5 }, { year: '2021', value: 0.9 }, { year: '2022', value: 2.0 }, { year: '2023', value: 0.2 }, { year: '2024', value: 0.8 }] },
      ],
    },
    industry_cycle: {
      phase: '调整期',
      summary: '商业地产行业处于调整期，供给增速放缓，结构性机会显现。',
      indicators: [
        { name: '商业空置率', current: '9.2%', trend: '下降', points: [{ year: '2020', value: 12.5 }, { year: '2021', value: 11.0 }, { year: '2022', value: 10.5 }, { year: '2023', value: 9.8 }, { year: '2024', value: 9.2 }] },
        { name: '租金指数', current: '101.5', trend: '上升', points: [{ year: '2020', value: 96.0 }, { year: '2021', value: 98.5 }, { year: '2022', value: 97.0 }, { year: '2023', value: 100.0 }, { year: '2024', value: 101.5 }] },
        { name: '资本化率', current: '5.5%', trend: '平稳', points: [{ year: '2020', value: 5.0 }, { year: '2021', value: 5.1 }, { year: '2022', value: 5.2 }, { year: '2023', value: 5.4 }, { year: '2024', value: 5.5 }] },
      ],
    },
    city_analysis: {
      city: '上海',
      summary: '上海作为中国商业地产最活跃的城市之一，拥有成熟的商业生态和强大的消费能力。',
      project_location: { lat: 31.2304, lng: 121.4737, name: '核心商业区' },
      competitors: [
        { lat: 31.2397, lng: 121.4998, name: '正大广场', type: '购物中心', distance: '2.5km', area: '24万㎡' },
        { lat: 31.1962, lng: 121.4354, name: '港汇恒隆', type: '购物中心', distance: '3.8km', area: '20万㎡' },
      ],
    },
  };
}
