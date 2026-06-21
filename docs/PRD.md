# SlackClone - 高仿 Slack 办公协作平台

## 项目概述

**项目名称**: SlackClone  
**项目类型**: 企业级即时通讯与协作平台  
**目标**: 高度还原 Slack 的核心功能与用户体验，打造一个完整的办公协作工具  
**版本**: v1.0.0  
**创建日期**: 2026-06-15

---

## 一、产品定位

SlackClone 是一款面向团队的企业级即时通讯和协作平台，致力于：
- 提供高效的团队沟通渠道
- 支持多工作区、多频道的信息组织
- 实现实时消息同步与文件共享
- 提供可扩展的集成能力

### 目标用户
- **主要用户**: 中小型企业团队、创业公司、远程协作团队
- **次要用户**: 大型企业部门级沟通、项目管理团队

---

## 二、核心功能模块

### 2.1 用户系统 (P0)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 用户注册 | 邮箱+密码注册 | 支持邮箱验证 |
| 用户登录 | 邮箱/用户名登录 | JWT Token 认证 |
| 个人资料 | 头像、昵称、状态设置 | 支持自定义状态文案 |
| 在线状态 | online / away / busy / offline | 实时同步 |

### 2.2 工作区管理 (P0)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 创建工作区 | 设置名称、图标、URL | 自动生成邀请链接 |
| 加入工作区 | 通过链接或搜索加入 | 管理员审核（可选） |
| 切换工作区 | 多工作区快速切换 | 左侧栏顶部切换器 |
| 工作区设置 | 名称修改、图标上传、成员管理 | 仅管理员可操作 |

### 2.3 频道系统 (P0)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 公开频道 | 工作区内所有成员可见 | 成员自由加入/离开 |
| 私有频道 | 仅受邀成员可见 | 需要邀请才能加入 |
| 频道分类 | 按项目/主题分组 | 自定义分组名称 |
| 频道详情 | 主题、描述、成员列表、置顶消息 | 可编辑元信息 |
| 频道置顶 | 常用频道固定在列表顶部 | 最多置顶 10 个 |

### 2.4 即时消息 (P0)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 文本消息 | 支持 Markdown 格式 | 实时发送与接收 |
| @提及 | @用户名 触发通知 | 高亮显示被提及者 |
| 表情反应 | 消息下方添加 emoji 反应 | 支持多种 emoji |
| 消息编辑 | 编辑已发送的消息 | 显示"已编辑"标记 |
| 消息删除 | 删除消息（软删除） | 权限控制 |
| 打字指示器 | "XXX 正在输入..." | 实时显示 |
| 消息时间戳 | 相对时间 + 精确时间悬停 | 格式: 刚刚/X分钟前 |

### 2.5 直接消息 DM (P0)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 1对1 私聊 | 两个用户之间的私密对话 | 加密传输 |
| 群组私信 | 多人私聊（类似小群） | 最多 9 人 |
| DM 列表 | 所有私聊会话列表 | 按最近活动排序 |

### 2.6 线程回复 (P1)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 开启线程 | 对某条消息发起线程讨论 | 不干扰主频道 |
| 线程视图 | 展开查看所有回复 | 侧边栏或弹窗展示 |
| 线程计数 | 显示未读回复数量 | 徽章提示 |

### 2.7 文件共享 (P1)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 文件上传 | 拖拽或点击上传 | 支持 jpg/png/pdf/doc/txt |
| 文件预览 | 内嵌预览图片/PDF | 不需下载即可查看 |
| 文件下载 | 下载到本地 | 批量下载支持 |
| 文件搜索 | 按名称/类型/上传者搜索 | 全文检索 |

### 2.8 搜索功能 (P1)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 全文搜索 | 搜索消息内容 | 支持模糊匹配 |
| 高级筛选 | 按频道/时间/作者/类型筛选 | 组合条件查询 |
| 搜索历史 | 记录最近搜索词 | 本地存储 |
| 快捷键 | Cmd/Ctrl + K 快速打开 | 聚焦即搜 |

### 2.9 通知系统 (P0)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 未读标记 | 频道旁显示未读数 | 圆点 + 数字徽章 |
| 推送通知 | 浏览器桌面通知 | 用户授权后可用 |
| 通知偏好 | 全部消息/仅@提及/关闭 | 每个频道独立设置 |
| 频道静音 | 临时静音 1 小时/直到明天 | 减少打扰 |

### 2.10 Huddles 音视频通话 (P2)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 语音通话 | 频道内发起语音通话 | WebRTC 实现 |
| 视频通话 | 开启摄像头视频通话 | 画中画模式 |
| 屏幕共享 | 共享屏幕给其他参与者 | 低延迟 |
| 举手功能 | 会议中举手示意 | 可视化反馈 |

### 2.11 Canvas 协作文档 (P2)

| 功能 | 描述 | 验收标准 |
|------|------|----------|
| 创建文档 | 富文本编辑器创建文档 | 支持标题/列表/代码块 |
| 实时协作 | 多人同时编辑 | 冲突解决机制 |
| 文档嵌入 | 在频道中分享文档卡片 | 点击展开 |
| 模板库 | 预设文档模板 | 会议纪要/项目计划等 |

---

## 三、UI 设计规范

### 3.1 整体布局

采用经典三栏式布局：

```
┌──────────────────────────────────────────────────────────────┐
│                    顶部导航栏 (Header)                         │
│  [工作区图标] 工作区名称 ▼  │  搜索框(Cmd+K) │  [头像] [帮助]   │
├──────────┬─────────────────┬──────────────────────────────────┤
│          │                 │                                   │
│  左侧栏  │    中间栏        │           主内容区                │
│ (Sidebar)│ (Channel List)  │       (Message Area)             │
│          │                 │                                   │
│ 240px    │    280px        │         flex-1 (自适应)           │
│          │                 │                                   │
│ - 导航   │ - 频道分组      │  ┌────────────────────────────┐   │
│ - 频道   │ - 频道列表      │  │ 频道头部信息               │   │
│ - DM     │ - DM 列表       │  ├────────────────────────────┤   │
│ - 应用   │ - 应用入口      │  │                            │   │
│          │                 │  │      消息流区域            │   │
│          │                 │  │     (虚拟滚动)             │   │
│          │                 │  │                            │   │
│          │                 │  ├────────────────────────────┤   │
│          │                 │  │  消息输入框 + 工具栏       │   │
│          │                 │  └────────────────────────────┘   │
└──────────┴─────────────────┴──────────────────────────────────┘
```

### 3.2 配色方案

```css
/* 主色调 */
--color-primary: #611f69;        /* Slack 紫 */
--color-primary-light: #7d3c86;
--color-primary-dark: #4a154b;

/* 功能色 */
--color-success: #0f7840;        /* 绿色 - 在线/成功 */
--color-danger: #da2e38;         /* 红色 - 错误/危险 */
--color-warning: #ecb22e;        /* 黄色 - 警告 */
--color-info: #1264a3;           /* 蓝色 - 信息/链接 */

/* 中性色 */
--bg-sidebar: #f8f8f8;           /* 侧边栏背景 */
--bg-main: #ffffff;              /* 主区域背景 */
--bg-hover: #f0f0f0;             /* 悬停背景 */
--bg-active: #ebebeb;            /* 选中背景 */
--bg-input: #ffffff;             /* 输入框背景 */

/* 文字色 */
--text-primary: #1d1c1d;         /* 主要文字 */
--text-secondary: #616061;       /* 次要文字 */
--text-muted: #8e8a8a;           /* 弱化文字 */
--text-link: #1264a3;            /* 链接文字 */

/* 边框色 */
--border-color: #dddcdc;         /* 分隔线 */
--border-focus: #1264a3;         /* 聚焦边框 */
```

### 3.3 字体规范

```
字体家族: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif

字号层级:
- 页面标题: 24px / font-weight: 700
- 频道名称: 18px / font-weight: 800
- 消息正文: 15px / font-weight: 400
- 辅助文字: 12px / font-weight: 400
- 元数据(时间戳): 11px / font-weight: 400

行高:
- 标题: 1.25
- 正文: 1.5
- 紧凑: 1.2
```

### 3.4 组件规范

#### 消息气泡
- 发送者头像: 36x36 圆形
- 消息间距: 同一用户连续消息合并显示
- 时间分隔线: 每 5 分钟自动插入日期/时间分割
- 悬停效果: 显示反应按钮和时间戳

#### 频道列表项
- 高度: 32px
- 图标宽度: 20px
- 未读指示: 左侧 4px 紫色竖条
- 未读数字: 右侧圆形徽章，白色文字紫色背景
- 悬停: 浅灰背景 + 操作按钮显现

#### 输入框
- 最小高度: 44px
- 最大高度: 200px (超出滚动)
- 占位符: "向 #频道名 发送消息"
- 工具栏: 格式化、附件、表情、@提及、GIF

---

## 四、技术架构

### 4.1 技术栈选型

```
前端技术栈:
├── 框架: React 18 + TypeScript 5.x
├── 构建工具: Vite 5.x
├── 状态管理: Zustand (轻量) + React Query (服务端状态)
├── UI 组件: 自定义组件 + Radix UI (无障碍)
├── 样式方案: Tailwind CSS 3.x + CSS Modules
├── 实时通信: Socket.io-client
├── 路由: React Router v6
├── 虚拟滚动: @tanstack/react-virtual
├── 表单: React Hook Form + Zod 校验
├── 图表: Recharts (统计面板)
└── 动画: Framer Motion

后端技术栈:
├── 运行时: Node.js 20 LTS
├── 框架: Express.js / Fastify
├── 语言: TypeScript
├── ORM: Prisma
├── 数据库: PostgreSQL 16
├── 缓存: Redis 7 (会话 + 消息队列)
├── 实时通信: Socket.io
├── 认证: JWT (jsonwebtoken) + bcrypt
├── 文件存储: Multer (本地) / MinIO (对象存储)
├── 日志: Pino
├── API 文档: Swagger/OpenAPI
└── 测试: Jest + Supertest
```

### 4.2 系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                      客户端层                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │
│  │ Web App  │  │ Mobile   │  │ Admin Dashboard      │   │
│  │ (React)  │  │ (React   │  │ (未来扩展)           │   │
│  │          │  │ Native)  │  │                      │   │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘   │
│       │              │                     │              │
│       └──────────────┼─────────────────────┘              │
│                      │ HTTP / WebSocket                   │
└──────────────────────┼────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│                  API 网关 / 负载均衡                        │
│              (Nginx / 未来 Kong)                           │
└──────────────────────┼────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│                      服务层                                │
│  ┌──────────────────────────────────────────────────┐     │
│  │              Application Server                   │     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │     │
│  │  │ Auth    │ │ Channel │ │ Message │ │ File   │ │     │
│  │  │ Service │ │ Service │ │ Service │ │Service │ │     │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────┘ │     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │     │
│  │  │ Search  │ │ Notif   │ │ User    │ │WS     │ │     │
│  │  │ Service │ │ Service │ │ Service │ │Gateway │ │     │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────┘ │     │
│  └──────────────────────────────────────────────────┘     │
└──────────────────────┼────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│                      数据层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │PostgreSQL│  │  Redis   │  │  文件存储             │    │
│  │ (主数据库)│  │ (缓存/   │  │  (MinIO / 本地)      │    │
│  │          │  │  会话/   │  │                      │    │
│  │          │  │  队列)   │  │                      │    │
│  └──────────┘  └──────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 4.3 API 接口设计

#### 认证模块 `POST /api/auth`
```
POST   /auth/register          # 注册
POST   /auth/login             # 登录
POST   /auth/logout            # 登出
GET    /auth/me                # 获取当前用户信息
PUT    /auth/profile           # 更新个人资料
POST   /auth/avatar            # 上传头像
```

#### 工作区模块 `/api/workspaces`
```
GET    /workspaces             # 获取我的工作区列表
POST   /workspaces             # 创建工作区
GET    /workspaces/:id         # 获取工作区详情
PUT    /workspaces/:id         # 更新工作区信息
DELETE /workspaces/:id         # 删除工作区
POST   /workspaces/:id/join    # 加入工作区
POST   /workspaces/:id/invite  # 邀请成员
GET    /workspaces/:id/members # 获取成员列表
```

#### 频道模块 `/api/channels`
```
GET    /channels?workspace_id= # 获取频道列表
POST   /channels               # 创建频道
GET    /channels/:id           # 获取频道详情(含消息)
PUT    /channels/:id           # 更新频道信息
DELETE /channels/:id           # 归档频道
POST   /channels/:id/members   # 添加成员
DELETE /channels/:id/members/:userId  # 移除成员
POST   /channels/:id/pin       # 置顶频道
POST   /channels/:id/mute      # 静音频道
```

#### 消息模块 `/api/messages`
```
GET    /messages?channel_id=&cursor=  # 分页获取消息
POST   /messages               # 发送消息
PUT    /messages/:id           # 编辑消息
DELETE /messages/:id           # 删除消息
POST   /messages/:id/reactions # 添加表情反应
DELETE /messages/:id/reactions/:emoji  # 移除表情反应
GET    /messages/:id/thread    # 获取线程回复
POST   /messages/:id/thread    # 回复线程
```

#### 文件模块 `/api/files`
```
POST  /files/upload            # 上传文件
GET    /files/:id              # 获取文件信息
GET    /files/:id/download     # 下载文件
GET    /files?channel_id=      # 获取频道文件列表
DELETE /files/:id              # 删除文件
```

#### 搜索模块 `/api/search`
```
GET    /search?q=&type=&channel_id=  # 全文搜索
GET    /search/suggestions    # 搜索建议
GET    /search/recent        # 最近搜索记录
```

### 4.4 WebSocket 事件设计

```typescript
// 连接认证
socket.emit('auth', { token: 'jwt_token' });

// 消息相关
socket.on('message:new', data);           // 新消息
socket.emit('message:send', data);        // 发送消息
socket.on('message:update', data);        // 消息更新(编辑)
socket.on('message:delete', data);        // 消息删除

// 状态相关
socket.emit('user:status', status);       // 上报在线状态
socket.on('user:status:change', data);    // 其他用户状态变化
socket.emit('user:typing', { channelId, isTyping });  // 打字状态
socket.on('user:typing', data);           // 收到打字状态

// 频道相关
socket.emit('channel:join', channelId);   // 加入频道房间
socket.emit('channel:leave', channelId);  // 离开频道房间
socket.on('member:join', data);           // 成员加入
socket.on('member:leave', data);          // 成员离开

// 通知相关
socket.on('notification:new', data);      // 新通知
socket.on('unread:update', data);         // 未读数更新
```

---

## 五、数据库 ER 关系

```
┌──────────┐     1:N     ┌──────────────────┐
│  users   │◄────────────│ workspace_members │
└────┬─────┘             └────────┬─────────┘
     │                            │
     │ 1:N                        │ N:1
     │                    ┌───────▼─────────┐
     └───────────────────►│   workspaces    │
                          └───────┬─────────┘
                                  │ 1:N
                                  │
                          ┌───────▼─────────┐
                          │    channels     │
                          └───────┬─────────┘
                                  │ 1:N
                    ┌─────────────┴─────────────┐
                    │ 1:N                       │ 1:N
          ┌─────────▼──────────┐    ┌──────────▼─────────┐
          │ channel_members    │    │      messages       │
          └────────────────────┘    └──────────┬─────────┘
                                               │ 1:N (自引用)
                                               │
                                      ┌────────▼────────┐
                                      │  thread_replies │
                                      └─────────────────┘

其他关联关系:
- users 1:N messages (用户发消息)
- channels 1:N files (频道文件)
- messages 1:N reactions (消息反应)
- messages 1:N attachments (消息附件)
```

---

## 六、开发阶段规划

### Phase 1: MVP 基础版（第 1-3 周）

**目标**: 可用的基础聊天应用

- [ ] 项目初始化（前后端脚手架）
- [ ] 数据库设计与迁移
- [ ] 用户注册/登录/JWT 认证
- [ ] 工作区创建与加入
- [ ] 公开频道 CRUD
- [ ] 实时文本消息收发（WebSocket）
- [ ] 基本的三栏 UI 布局
- [ ] 用户在线状态
- [ ] 未读消息计数

### Phase 2: 核心增强版（第 4-6 周）

**目标**: 功能完善的协作工具

- [ ] 私有频道
- [ ] 直接消息（DM）与群组私信
- [ ] @提及 和表情反应
- [ ] 线程回复
- [ ] 文件上传/预览/下载
- [ ] 消息编辑与删除
- [ ] 全文搜索
- [ ] 通知偏好设置
- [ ] 频道置顶与收藏
- [ ] 消息虚拟滚动优化

### Phase 3: 高级功能版（第 7-10 周）

**目标**: 接近生产级的完整产品

- [ ] Huddles 音频通话（WebRTC）
- [ ] Canvas 协作文档
- [ ] 工作区邀请链接
- [ ] 管理后台
- [ ] 移动端响应式适配
- [ ] 性能监控与日志
- [ ] Docker 容器化部署
- [ ] CI/CD 流水线

### Phase 4: 扩展迭代（持续）

- [ ] 第三方应用集成框架
- [ ] AI 助手（Slackbot）
- [ ] 工作流自动化
- [ ] 多语言国际化
- [ ] 深色模式
- [ ] 键盘快捷键完善
- [ ] 无障碍访问（A11y）优化

---

## 七、非功能性需求

### 7.1 性能指标
- 消息延迟 < 200ms（局域网内）
- 首屏加载 < 2s（3G 网络）
- 支持 10000 并发连接（单实例）
- 消息列表流畅滚动（60fps）

### 7.2 安全要求
- 密码 bcrypt 加密存储（salt rounds >= 12）
- JWT Token 有效期 7 天 + Refresh Token 30 天
- HTTPS 强制加密传输
- XSS / CSRF 防护
- 文件上传大小限制（单文件 < 50MB）
- 文件类型白名单校验
- SQL 注入防护（ORM 参数化查询）
- Rate Limiting（100 req/min per user）

### 7.3 兼容性
- Chrome >= 90
- Firefox >= 88
- Safari >= 14
- Edge >= 90
- 移动端 iOS Safari / Android Chrome

---

## 八、第三方依赖清单

### 前端依赖
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.35.0",
    "@tanstack/react-virtual": "^3.5.0",
    "socket.io-client": "^4.7.0",
    "tailwindcss": "^3.4.0",
    "framer-motion": "^11.2.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.23.0",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.379.0",
    "clsx": "^2.1.0",
    "react-hot-toast": "^2.4.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.5.0"
  }
}
```

### 后端依赖
```json
{
  "dependencies": {
    "express": "^4.19.0",
    "socket.io": "^4.7.0",
    "prisma": "^5.13.0",
    "@prisma/client": "^5.13.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.2.0",
    "ioredis": "^5.4.0",
    "pino": "^8.19.0",
    "zod": "^3.23.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.10.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "prisma": "^5.13.0"
  }
}
```

---

## 九、目录结构详细说明

```
SlackApp/
├── docs/                          # 项目文档
│   ├── PRD.md                     # 产品需求文档（本文件）
│   ├── api.md                     # API 接口文档
│   └── database-design.md         # 数据库设计文档
│
├── client/                        # 前端应用 (React)
│   ├── public/
│   │   └── favicon.ico
│   ├── src/
│   │   ├── main.tsx               # 入口文件
│   │   ├── App.tsx                # 根组件
│   │   ├── index.css              # 全局样式/Tailwind
│   │   │
│   │   ├── components/            # 通用组件
│   │   │   ├── ui/                # 基础 UI 组件
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Tooltip.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Dropdown.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── layout/            # 布局组件
│   │   │   │   ├── AppLayout.tsx  # 主布局容器
│   │   │   │   ├── Header.tsx     # 顶部导航
│   │   │   │   └── WorkspaceSwitcher.tsx
│   │   │   │
│   │   │   ├── sidebar/           # 左侧边栏
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── WorkspaceSection.tsx
│   │   │   │   ├── ChannelSection.tsx
│   │   │   │   └── DirectMessagesSection.tsx
│   │   │   │
│   │   │   ├── channel-list/      # 中间频道列表
│   │   │   │   ├── ChannelList.tsx
│   │   │   │   ├── ChannelItem.tsx
│   │   │   │   ├── ChannelGroup.tsx
│   │   │   │   ├── DMItem.tsx
│   │   │   │   └── ChannelHeader.tsx
│   │   │   │
│   │   │   ├── message-area/      # 主聊天区域
│   │   │   │   ├── MessageArea.tsx
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageItem.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── MessageReactions.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   ├── MessageToolbar.tsx
│   │   │   │   ├── ThreadPanel.tsx
│   │   │   │   └── DateSeparator.tsx
│   │   │   │
│   │   │   └── search/            # 搜索组件
│   │   │       ├── SearchDialog.tsx
│   │   │       ├── SearchResultItem.tsx
│   │   │       └── SearchFilters.tsx
│   │   │
│   │   ├── pages/                # 页面组件
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── WorkspacePage.tsx
│   │   │   ├── ChannelPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   │
│   │   ├── hooks/                # 自定义 Hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useSocket.ts
│   │   │   ├── useMessages.ts
│   │   │   ├── useChannels.ts
│   │   │   ├── useSearch.ts
│   │   │   └── useVirtualScroll.ts
│   │   │
│   │   ├── stores/               # Zustand 状态管理
│   │   │   ├── authStore.ts
│   │   │   ├── workspaceStore.ts
│   │   │   ├── channelStore.ts
│   │   │   ├── messageStore.ts
│   │   │   ├── uiStore.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── services/             # API 服务层
│   │   │   ├── api.ts            # Axios 实例配置
│   │   │   ├── authService.ts
│   │   │   ├── workspaceService.ts
│   │   │   ├── channelService.ts
│   │   │   ├── messageService.ts
│   │   │   ├── fileService.ts
│   │   │   └── searchService.ts
│   │   │
│   │   ├── lib/                  # 工具库
│   │   │   ├── socket.ts         # Socket.io 配置
│   │   │   ├── utils.ts          # 通用工具函数
│   │   │   ├── constants.ts      # 常量定义
│   │   │   └── validators.ts     # Zod 校验 schema
│   │   │
│   │   └── types/                # TypeScript 类型定义
│   │       ├── auth.ts
│   │       ├── workspace.ts
│   │       ├── channel.ts
│   │       ├── message.ts
│   │       ├── user.ts
│   │       └── common.ts
│   │
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── package.json
│
├── server/                       # 后端服务 (Node.js)
│   ├── src/
│   │   ├── index.ts              # 服务入口
│   │   ├── app.ts                # Express 应用配置
│   │   │
│   │   ├── config/               # 配置
│   │   │   ├── database.ts
│   │   │   ├── redis.ts
│   │   │   └── env.ts
│   │   │
│   │   ├── routes/               # 路由定义
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── workspace.routes.ts
│   │   │   ├── channel.routes.ts
│   │   │   ├── message.routes.ts
│   │   │   ├── file.routes.ts
│   │   │   └── search.routes.ts
│   │   │
│   │   ├── controllers/          # 控制器
│   │   │   ├── auth.controller.ts
│   │   │   ├── workspace.controller.ts
│   │   │   ├── channel.controller.ts
│   │   │   ├── message.controller.ts
│   │   │   ├── file.controller.ts
│   │   │   └── search.controller.ts
│   │   │
│   │   ├── services/             # 业务逻辑层
│   │   │   ├── auth.service.ts
│   │   │   ├── workspace.service.ts
│   │   │   ├── channel.service.ts
│   │   │   ├── message.service.ts
│   │   │   ├── file.service.ts
│   │   │   └── search.service.ts
│   │   │
│   │   ├── middleware/           # 中间件
│   │   │   ├── auth.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimit.ts
│   │   │
│   │   ├── socket/               # WebSocket 处理
│   │   │   ├── index.ts
│   │   │   ├── auth.handler.ts
│   │   │   ├── message.handler.ts
│   │   │   ├── presence.handler.ts
│   │   │   └── typing.handler.ts
│   │   │
│   │   ├── models/               # Prisma Schema
│   │   │   └── schema.prisma
│   │   │
│   │   └── types/                # 类型定义
│   │       └── index.ts
│   │
│   ├── prisma/
│   │   └── schema.prisma
│   │
│   ├── uploads/                  # 文件上传目录
│   ├── tsconfig.json
│   ├── package.json
│   └── tsconfig.server.json
│
├── shared/                       # 前后端共享
│   └── types/
│       └── index.ts
│
├── docker-compose.yml            # Docker 编排
├── .env.example                  # 环境变量示例
├── .gitignore
└── README.md
```

---

## 十、环境变量配置

```env
# .env.example

# 服务端
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

# 数据库
DATABASE_URL="postgresql://postgres:password@localhost:5432/slackclone?schema=public"

# Redis
REDIS_URL=redis://localhost:6379

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800  # 50MB
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain,application/msword

# CORS
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 十一、关键实现注意事项

### 11.1 消息顺序保证
- 使用递增的雪花 ID 或 UUID v7 保证时序性
- WebSocket 断线重连后通过 last_message_id 增量拉取
- 乐观更新 + 回滚机制处理网络异常

### 11.2 虚拟滚动性能
- 消息列表使用虚拟滚动渲染可见区域
- 固定高度估算 + 动态测量校正
- 滚动到底部自动加载新消息
- 历史消息向上滚动分页加载

### 11.3 安全考量
- 所有 API 必须经过认证中间件
- 文件上传必须校验 MIME 类型（不仅看扩展名）
- Socket.io 连接也需要 Token 认证
- 敏感操作需要二次确认
- 防止 XSS：消息内容转义渲染

### 11.4 离线/弱网处理
- 消息发送失败进入重试队列
- 本地 IndexedDB 缓存近期消息
- 离线状态下允许浏览历史消息
- 重连后自动同步离线期间的消息
```
