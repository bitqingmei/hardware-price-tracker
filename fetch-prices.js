const puppeteer = require('puppeteer');
const fs = require('fs');

// 配置
const SERVER_URL = process.env.SERVER_URL || 'http://69.5.22.248:3001';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 汇率
const JPY_TO_CNY = 0.047;
const USD_TO_CNY = 7.2;

// 产品列表
const PRODUCTS = [
  {
    id: 'rtx5090',
    name: 'RTX 5090',
    searchUrl: 'https://www.amazon.com/s?k=RTX+5090+graphics+card&ref=nb_sb_noss',
    defaultPrice: 32999
  },
  {
    id: 'rtx4090',
    name: 'RTX 4090',
    searchUrl: 'https://www.amazon.com/s?k=RTX+4090+graphics+card&ref=nb_sb_noss',
    defaultPrice: 15999
  },
  {
    id: 'rtx5080',
    name: 'RTX 5080',
    searchUrl: 'https://www.amazon.com/s?k=RTX+5080+graphics+card&ref=nb_sb_noss',
    defaultPrice: 9999
  },
  {
    id: 'rtx4080',
    name: 'RTX 4080 Super',
    searchUrl: 'https://www.amazon.com/s?k=RTX+4080+Super+graphics+card&ref=nb_sb_noss',
    defaultPrice: 8999
  },
  {
    id: 'rtx5070',
    name: 'RTX 5070 Ti',
    searchUrl: 'https://www.amazon.com/s?k=RTX+5070+Ti+graphics+card&ref=nb_sb_noss',
    defaultPrice: 5999
  },
  {
    id: 'rtx4070',
    name: 'RTX 4070 Super',
    searchUrl: 'https://www.amazon.com/s?k=RTX+4070+Super+graphics+card&ref=nb_sb_noss',
    defaultPrice: 4999
  }
];

async function sendTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('Telegram 未配置，跳过通知');
    return;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });
    console.log('Telegram 通知已发送');
  } catch (error) {
    console.error('Telegram 发送失败:', error.message);
  }
}

async function fetchAmazonPrice(page, product) {
  try {
    console.log(`\n📦 正在抓取: ${product.name}`);
    console.log(`   URL: ${product.searchUrl}`);
    
    await page.goto(product.searchUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // 等待搜索结果加载
    await page.waitForSelector('[data-component-type="s-search-result"]', { timeout: 10000 });
    
    // 提取第一个真实产品的价格
    const result = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-component-type="s-search-result"]');
      
      for (const item of items) {
        // 获取标题
        const titleElem = item.querySelector('h2 a span');
        if (!titleElem) continue;
        
        const title = titleElem.textContent.trim();
        
        // 跳过不相关的产品
        if (title.toLowerCase().includes('case') || 
            title.toLowerCase().includes('fan') ||
            title.toLowerCase().includes('cable') ||
            title.toLowerCase().includes('adapter')) {
          continue;
        }
        
        // 获取价格
        const priceWhole = item.querySelector('.a-price-whole');
        const priceFraction = item.querySelector('.a-price-fraction');
        const currency = item.querySelector('.a-price-symbol');
        
        if (priceWhole) {
          const whole = priceWhole.textContent.replace(/[^0-9]/g, '');
          const fraction = priceFraction ? priceFraction.textContent : '00';
          const currencySymbol = currency ? currency.textContent.trim() : '$';
          
          return {
            title: title.substring(0, 100),
            price: parseFloat(`${whole}.${fraction}`),
            currency: currencySymbol
          };
        }
      }
      
      return null;
    });
    
    if (result) {
      console.log(`   ✅ 找到: ${result.title}`);
      console.log(`   💰 价格: ${result.currency}${result.price}`);
      return result;
    } else {
      console.log(`   ⚠️ 未找到价格，使用默认值`);
      return null;
    }
    
  } catch (error) {
    console.error(`   ❌ 抓取失败: ${error.message}`);
    return null;
  }
}

async function updateServerPrice(productId, priceCNY) {
  try {
    const response = await fetch(`${SERVER_URL}/api/prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        products: [{
          id: productId,
          price: priceCNY
        }]
      })
    });
    
    if (response.ok) {
      console.log(`   ✅ 服务器已更新: ¥${priceCNY}`);
      return true;
    } else {
      console.log(`   ⚠️ 服务器返回: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ 服务器更新失败: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log('GPU 价格自动抓取器');
  console.log(`时间: ${new Date().toISOString()}`);
  console.log('========================================\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // 设置视口
  await page.setViewport({ width: 1920, height: 1080 });
  
  const results = [];
  let successCount = 0;
  
  for (const product of PRODUCTS) {
    const result = await fetchAmazonPrice(page, product);
    
    let priceCNY = product.defaultPrice;
    let currency = 'USD';
    
    if (result) {
      currency = result.currency;
      
      // 转换为人民币
      if (currency === '¥' || currency === 'JPY') {
        priceCNY = Math.round(result.price * JPY_TO_CNY);
      } else if (currency === '$') {
        priceCNY = Math.round(result.price * USD_TO_CNY);
      }
      
      // 更新服务器
      const updated = await updateServerPrice(product.id, priceCNY);
      if (updated) successCount++;
    }
    
    results.push({
      id: product.id,
      name: product.name,
      price_original: result ? result.price : null,
      currency: currency,
      price_cny: priceCNY,
      title: result ? result.title : null,
      success: !!result
    });
    
    // 随机等待，避免被反爬
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }
  
  await browser.close();
  
  // 保存结果
  const priceData = {
    last_update: new Date().toISOString(),
    exchange_rate: {
      jpy_to_cny: JPY_TO_CNY,
      usd_to_cny: USD_TO_CNY
    },
    products: results
  };
  
  fs.writeFileSync('prices.json', JSON.stringify(priceData, null, 2));
  console.log('\n📄 价格已保存到 prices.json');
  
  // 发送 Telegram 通知
  const successList = results.filter(r => r.success).map(r => 
    `• ${r.name}: ¥${r.price_cny}`
  ).join('\n');
  
  const failedList = results.filter(r => !r.success).map(r => r.name).join(', ');
  
  let message = `📊 *GPU 价格更新完成*\n\n`;
  message += `✅ 成功: ${successCount}/${PRODUCTS.length}\n\n`;
  message += `${successList}`;
  
  if (failedList) {
    message += `\n\n⚠️ 失败: ${failedList}`;
  }
  
  await sendTelegram(message);
  
  console.log('\n========================================');
  console.log(`完成！成功更新 ${successCount}/${PRODUCTS.length} 个价格`);
  console.log('========================================');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
