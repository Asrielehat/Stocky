# Stocky 本地部署指南

如果您想在自己的电脑上运行这个应用，请按照以下步骤操作：

## 1. 环境准备
*   安装 [Node.js](https://nodejs.org/) (建议从 v20+ 开始)。
*   准备一个 **科学上网代理软件** (如 Clash, V2Ray 等)。

## 2. 安装依赖
在项目根目录打开终端 (Terminal)，执行：
```bash
npm install
```

## 3. 配置密钥 (.env)
1. 在项目根目录创建一个名为 `.env` 的文件。
2. 填入您的 Gemini API Key：
   ```env
   GEMINI_API_KEY=AIzaSy...你的真实密钥
   ```

## 4. 解决网络连接问题 (重要)
由于 Gemini API 的服务器在海外，国内本地运行需要设置代理。

### 方式 A：临时命令启动 (推荐)
根据您的代理端口 (如 7899)，在终端运行：
*   **PowerShell**:
    ```powershell
    $env:HTTPS_PROXY="http://127.0.0.1:7899"; npm run dev
    ```
*   **CMD**:
    ```cmd
    set HTTPS_PROXY=http://127.0.0.1:7899 && npm run dev
    ```

### 方式 B：开启代理软件的 "TUN 模式"
如果您的代理软件支持 TUN 模式 (虚拟网卡)，开启后只需直接运行 `npm run dev` 即可。

## 5. 模型 404 错误提示
如果报错 `404 Not Found`，通常是因为：
*   使用了错误的模型别名。本程序默认使用 `gemini-1.5-flash`。
*   您的 API Key 不支持该模型 (免费版 Key 默认支持 flash 模型)。

---
如果您在部署过程中遇到任何问题，请随时在 AI Studio 中咨询。
