"""小海Agent模块

包含所有小海Agent流程中的Agent实现：
- FlowStateManager: 状态持久化管理
- SecretaryAgent: 秘书Agent，提取结构化信息
- InvestmentAgent: 投资部Agent
- AssetManagementAgent: 资管部Agent
- MarketAnalystAgent: 市场部Agent
- OperationAgent: 运营部Agent
- FinancialModelerAgent: 财务部Agent
- DesignAgent: 设计部Agent
- EngineeringAgent: 工程部Agent
- CostAgent: 成本部Agent
- LegalAgent: 法律部Agent
- MASTER_REGISTRY: 32位投资大师注册表
- BaseMasterAgent: 大师Agent基类
- BuffettAgent: 巴菲特Agent，经济护城河与价值投资
- MungerAgent: 芒格Agent，多元思维模型
- DuanYongpingAgent: 段永平Agent，本分文化与长期主义
- PeterLynchAgent: 彼得·林奇Agent，草根调研与分类投资法
- MasterSkillAgent: 大师Agent（向后兼容别名，同BuffettAgent）
- DecisionMakerAgent: 决策者Agent，形成最终投资决策
"""

from backend.agents.flow_state_manager import FlowStateManager
from backend.agents.secretary_agent import SecretaryAgent
from backend.agents.department_agents import (
    AssetManagementAgent,
    CostAgent,
    DesignAgent,
    EngineeringAgent,
    FinancialModelerAgent,
    InvestmentAgent,
    LegalAgent,
    MarketAnalystAgent,
    OperationAgent,
)
from backend.agents.master_skill_agent import (
    MASTER_REGISTRY,
    BaseMasterAgent,
    BuffettAgent,
    DuanYongpingAgent,
    MasterSkillAgent,
    MungerAgent,
    PeterLynchAgent,
)
from backend.agents.decision_maker_agent import DecisionMakerAgent

__all__ = [
    "FlowStateManager",
    "SecretaryAgent",
    "InvestmentAgent",
    "AssetManagementAgent",
    "MarketAnalystAgent",
    "OperationAgent",
    "FinancialModelerAgent",
    "DesignAgent",
    "EngineeringAgent",
    "CostAgent",
    "LegalAgent",
    "MASTER_REGISTRY",
    "BaseMasterAgent",
    "BuffettAgent",
    "MungerAgent",
    "DuanYongpingAgent",
    "PeterLynchAgent",
    "MasterSkillAgent",
    "DecisionMakerAgent",
]
