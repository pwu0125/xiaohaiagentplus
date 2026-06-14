import type {
  StreamEvent,
  BookmarkOut,
  BookmarkListResponse,
  AgentInfo,
  AgentDiscussResponse,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const USE_MOCK = true; // 默认使用mock

export type { StreamEvent };

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
  const response = await fetch(`${API_BASE}/api/agents`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function discussWithAgents(
  topic: string,
  agentIds: string[],
  context?: string
): Promise<AgentDiscussResponse> {
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
    await delay(800 + Math.random() * 600);
    onEvent(event);
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
