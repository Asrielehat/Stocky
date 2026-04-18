# Stocky 📈

Stocky 是一款智能股价预测与实时行情监控工具。它结合了 Google Gemini AI 的强大分析能力、实时财经新闻以及历史股价数据，为投资者提供深度的市场洞察。

## ✨ 核心功能

- **AI 趋势预测**：利用 Google Gemini 模型，结合历史价格走势和最新市场新闻，预测未来 10 天的股价趋势。
- **实时行情监控**：集成 Yahoo Finance API，提供全球主流股市的实时报价及涨跌幅（精确保留三位小数）。
- **新闻情绪分析**：自动获取相关股票的最新财经新闻，AI 会在分析中综合考虑市场情绪。
- **特别关注列表**：主界面集成自选股列表，支持本地持久化存储，随时掌握心仪股票动态。
- **灵活数据导入**：支持通过股票代码在线导入数据，或上传自定义的 CSV 历史数据文件。
- **自定义时间维度**：支持自由调整历史数据查询范围，满足不同周期的分析需求。

## 🛠️ 技术栈

- **前端**: React 18, Vite, Tailwind CSS, Lucide React, Recharts
- **后端**: Node.js, Express
- **AI 模型**: Google Gemini API (@google/genai)
- **数据源**: Yahoo Finance (via `yahoo-finance2`)
- **部署**: Cloud Run / Docker

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/your-username/stocky.git
cd stocky
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
在根目录创建 `.env` 文件，并添加以下配置：
```env
GEMINI_API_KEY=你的_GEMINI_API_KEY
```

### 4. 启动开发服务器
```bash
npm run dev
```
访问 `http://localhost:3000` 即可开始使用。

## 📊 CSV 数据格式说明

如果您选择上传 CSV 文件，请确保包含以下列名（不区分大小写）：
- `Date`: 日期格式 (如 YYYY-MM-DD)
- `Close` 或 `Price`: 收盘价

## 注意事项

如果遇到api invalid的报错强烈建议开启TUN/虚拟网卡模式

## ⚠️ 免责声明

本工具提供的所有预测结果及分析内容均由 AI 生成，仅供参考。**不构成任何投资建议**。股市有风险，投资需谨慎。

---
Made with ❤️ by Stocky Team
