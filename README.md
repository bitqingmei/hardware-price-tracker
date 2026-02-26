# GPU 价格自动抓取器

每天自动抓取 Amazon/Newegg 的 GPU 价格，并推送到服务器。

## 功能

- ✅ GitHub Actions 每天自动运行
- ✅ 使用 Puppeteer 无头浏览器抓取
- ✅ 自动更新到你的服务器 API
- ✅ 失败时发送 Telegram 通知

## 部署步骤

### 1. 创建 GitHub 仓库

1. 打开 https://github.com/new
2. 仓库名: `hardware-price-tracker`
3. 选择 Private（私有）
4. 点击 Create repository

### 2. 上传文件

把这个文件夹里的所有文件上传到仓库

### 3. 配置 Secrets

在仓库设置里添加以下 Secrets (Settings → Secrets and variables → Actions):

| Secret 名称 | 值 |
|------------|---|
| `SERVER_URL` | `http://69.5.22.248:3001` |
| `TELEGRAM_BOT_TOKEN` | `8678866658:AAEb83nMcQYzv43z285nJzBV95seSeSfEEQ` |
| `TELEGRAM_CHAT_ID` | `2025233920` |

### 4. 启用 Actions

1. 进入 Actions 标签页
2. 启用 GitHub Actions
3. 手动运行一次测试

## 手动触发

在 Actions 页面点击 "Run workflow" 可以手动触发抓取

## 添加新产品

编辑 `products.json` 文件添加新的 GPU 产品
