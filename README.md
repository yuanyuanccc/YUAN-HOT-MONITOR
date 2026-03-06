# YUAN HOT MONITOR

AI 热点识别与人工确认系统，已按“先网页、后 Agent Skills”的节奏完成第一版交付。

## 已实现能力

- 网页端热点识别面板、AI结果面板、人工确认面板、历史记录面板
- 网页端多平台热点抓取展示、平台勾选、关键词抓取与自动抓取分钟配置
- 平台抓取支持大模型抽取优先（OpenRouter），无密钥时自动降级基础解析
- 后端热点分析接口、人工确认接口、历史查询接口
- 后端多平台聚合抓取接口、手动抓取接口、调度配置接口
- OpenRouter 接入（用于热点分析与平台抓取抽取，缺省密钥时自动降级本地分析/基础解析）
- Agent Skills：`hotspot-analyzer`、`hotspot-reviewer`

## 启动方式

### 1. 配置服务端环境变量

复制 `server/.env.example` 为 `server/.env` 并填写：

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`（可选）

### 2. 启动后端

```bash
cd server
npm install
npm run start
```

### 3. 启动前端

复制 `web/.env.example` 为 `web/.env`，然后执行：

```bash
cd web
npm install
npm run dev
```

## 接口

- `POST /api/hotspots/analyze`
- `POST /api/hotspots/confirm`
- `GET /api/hotspots/history`
- `GET /api/platform-hotspots`
- `POST /api/platform-hotspots/fetch`
- `POST /api/platform-hotspots/schedule`
- `GET /api/health`

## 测试

```bash
cd server
npm test
```

```bash
cd web
npm run lint
npm run build
```
