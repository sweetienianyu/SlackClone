import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// 文档模板预设
const TEMPLATES: Record<string, { title: string; content: string; description: string; icon: string; category: string }> = {
  blank: {
    title: '无标题文档',
    content: '',
    description: '从零开始的空白文档',
    icon: '📄',
    category: '基础',
  },
  meeting: {
    title: '会议纪要',
    content: '# 会议纪要\n\n**日期：** \n**参会人：** \n**记录人：** \n\n## 议题\n1. \n2. \n3. \n\n## 讨论内容\n\n### 议题一\n\n\n### 议题二\n\n\n## 决议\n- \n\n## 待办事项\n| 任务 | 负责人 | 截止日期 | 状态 |\n|------|--------|----------|------|\n|  |  |  | ⏳ |\n\n---\n*下次会议：*',
    description: '记录会议讨论、决议和待办事项',
    icon: '📝',
    category: '会议',
  },
  plan: {
    title: '项目计划',
    content: '# 项目计划\n\n**项目名称：** \n**负责人：** \n**开始日期：** \n**预计完成：** \n\n## 项目背景\n\n\n## 目标\n- 业务目标：\n- 技术目标：\n\n## 里程碑\n| 阶段 | 时间 | 交付物 | 负责人 |\n|------|------|--------|--------|\n| 启动 |  |  |  |\n| 开发 |  |  |  |\n| 测试 |  |  |  |\n| 上线 |  |  |  |\n\n## 资源需求\n- 人力：\n- 预算：\n- 工具：\n\n## 风险评估\n| 风险 | 概率 | 影响 | 应对策略 |\n|------|------|------|----------|\n|  |  |  |  |\n\n## 备注\n',
    description: '项目规划、里程碑和风险管理',
    icon: '📊',
    category: '项目管理',
  },
  retro: {
    title: '回顾总结',
    content: '# 回顾总结\n\n**周期：** \n**团队：** \n**日期：** \n\n## 做得好的 🟢\n- \n- \n\n## 需要改进的 🟡\n- \n- \n\n## 下一步行动 🔵\n- [ ] \n- [ ] \n\n## 数据回顾\n| 指标 | 上期 | 本期 | 变化 |\n|------|------|------|------|\n|  |  |  |  |\n\n## 团队反馈\n\n\n---\n*下次回顾：*',
    description: '团队迭代回顾与总结',
    icon: '🔄',
    category: '团队',
  },
  weekly: {
    title: '周报',
    content: '# 周报\n\n**姓名：** \n**周期：** 至 \n\n## 本周完成\n1. \n2. \n3. \n\n## 进行中\n- [ ] \n- [ ] \n\n## 下周计划\n1. \n2. \n\n## 遇到的问题\n- \n\n## 需要的支持\n- \n',
    description: '个人工作周报模板',
    icon: '📅',
    category: '汇报',
  },
  requirement: {
    title: '需求文档',
    content: '# 需求文档\n\n**需求名称：** \n**提出人：** \n**优先级：** P0/P1/P2\n**预计上线：** \n\n## 背景与目标\n\n\n## 用户故事\n作为【角色】，我希望【功能】，以便【价值】。\n\n## 功能需求\n### 模块一\n- \n\n### 模块二\n- \n\n## 非功能需求\n- 性能：\n- 兼容性：\n- 安全性：\n\n## 交互设计\n\n\n## 验收标准\n- [ ] \n- [ ] \n\n## 依赖与风险\n- \n',
    description: '产品需求文档（PRD）模板',
    icon: '📋',
    category: '产品',
  },
  onboarding: {
    title: '新人入职指南',
    content: '# 新人入职指南\n\n**欢迎加入团队！** 🎉\n\n## 第一天\n- [ ] 领取办公设备\n- [ ] 配置开发环境\n- [ ] 加入工作区 Slack\n- [ ] 认识团队成员\n\n## 第一周\n- [ ] 阅读团队规范文档\n- [ ] 完成第一个小任务\n- [ ] 参加周会\n\n## 开发环境配置\n```\n1. 安装 Node.js 20+\n2. 克隆仓库\ngit clone <repo-url>\n3. 安装依赖\nnpm install\n4. 启动开发环境\nnpm run dev\n```\n\n## 常用链接\n- 代码仓库：\n- 文档：\n- 任务看板：\n\n## 联系人\n- 导师：\n- 主管：\n- HR：\n',
    description: '新人入职流程与指引',
    icon: '👋',
    category: '团队',
  },
  brainstorm: {
    title: '头脑风暴',
    content: '# 头脑风暴\n\n**主题：** \n**日期：** \n**参与者：** \n\n## 背景介绍\n\n\n## 想法收集\n### 💡 想法 1\n\n**优点：**\n**缺点：**\n\n### 💡 想法 2\n\n**优点：**\n**缺点：**\n\n### 💡 想法 3\n\n**优点：**\n**缺点：**\n\n## 评估与筛选\n| 想法 | 可行性 | 价值 | 成本 | 优先级 |\n|------|--------|------|------|--------|\n|  | 高/中/低 | 高/中/低 | 高/中/低 | P0/P1/P2 |\n\n## 下一步\n- [ ] \n',
    description: '创意头脑风暴与想法评估',
    icon: '💡',
    category: '团队',
  },
  api: {
    title: 'API 设计文档',
    content: '# API 设计文档\n\n**接口名称：** \n**版本：** v1.0\n\n## 概述\n\n\n## 接口列表\n\n### 1. 接口名称\n`GET /api/v1/resource`\n\n**描述：**\n\n**请求参数：**\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n|  | string | 是 |  |\n\n**响应示例：**\n```json\n{\n  "code": 0,\n  "data": {},\n  "message": "success"\n}\n```\n\n**错误码：**\n| 错误码 | 说明 |\n|--------|------|\n| 400 | 参数错误 |\n| 404 | 资源不存在 |\n\n## 数据模型\n\n```typescript\ninterface Resource {\n  id: string;\n  name: string;\n  createdAt: string;\n}\n```\n',
    description: 'API 接口设计文档模板',
    icon: '🔌',
    category: '技术',
  },
  decision: {
    title: '决策记录',
    content: '# 决策记录 (ADR)\n\n**决策编号：** \n**日期：** \n**决策者：** \n**状态：** 提议 / 已接受 / 已实施 / 已废弃\n\n## 背景\n\n\n## 决策\n\n\n## 备选方案\n### 方案 A\n**优点：**\n**缺点：**\n\n### 方案 B\n**优点：**\n**缺点：**\n\n## 理由\n\n\n## 影响\n- 技术影响：\n- 业务影响：\n- 资源影响：\n\n## 后续行动\n- [ ] \n',
    description: '架构决策记录（ADR）',
    icon: '⚖️',
    category: '技术',
  },
};

// 获取文档列表
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = req.query.workspace_id as string;
    const channelId = req.query.channel_id as string | undefined;
    if (!workspaceId) return res.status(400).json({ error: 'workspace_id 必填' });

    const docs = await prisma.document.findMany({
      where: { workspaceId, ...(channelId ? { channelId } : {}) },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取单个文档
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
    });
    if (!doc) return res.status(404).json({ error: '文档不存在' });
    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 创建文档
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, title, content, template, channelId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId 必填' });

    const tpl = template && TEMPLATES[template] ? TEMPLATES[template] : TEMPLATES.blank;

    const doc = await prisma.document.create({
      data: {
        workspaceId,
        channelId: channelId || null,
        title: title || tpl.title,
        content: content !== undefined ? content : tpl.content,
        template: template || 'blank',
        createdBy: req.userId!,
      },
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新文档（支持部分更新）
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { title, content } = req.body;
    const data: any = {};
    if (title !== undefined) data.title = title;
    if (content !== undefined) data.content = content;

    const doc = await prisma.document.update({
      where: { id: req.params.id },
      data,
      include: {
        creator: { select: { id: true, displayName: true, avatarUrl: true } },
        channel: { select: { id: true, name: true } },
      },
    });

    // 通过 Socket 广播文档更新（实时协作）
    const io = req.app.get('io');
    if (io) {
      io.to(`doc:${doc.id}`).emit('document:update', { id: doc.id, title: doc.title, content: doc.content });
    }

    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除文档
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 获取模板列表（含分类）
router.get('/templates/list', async (_req: AuthRequest, res: Response) => {
  const categories: Record<string, any[]> = {};
  Object.entries(TEMPLATES).forEach(([key, val]) => {
    if (!categories[val.category]) categories[val.category] = [];
    categories[val.category].push({
      key,
      title: val.title,
      description: val.description,
      icon: val.icon,
      category: val.category,
      preview: val.content.slice(0, 300),
    });
  });
  res.json({
    templates: Object.entries(TEMPLATES).map(([key, val]) => ({
      key,
      title: val.title,
      description: val.description,
      icon: val.icon,
      category: val.category,
      preview: val.content.slice(0, 300),
    })),
    categories: Object.keys(categories),
  });
});

// 获取单个模板完整内容
router.get('/templates/:key', async (req: AuthRequest, res: Response) => {
  const tpl = TEMPLATES[req.params.key];
  if (!tpl) return res.status(404).json({ error: '模板不存在' });
  res.json({
    key: req.params.key,
    title: tpl.title,
    content: tpl.content,
    description: tpl.description,
    icon: tpl.icon,
    category: tpl.category,
  });
});

export default router;
