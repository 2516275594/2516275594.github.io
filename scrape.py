import requests
from lxml import html
import json
import os

url = "https://github.com/crossxx-labs/free-proxy"

# 发送请求
response = requests.get(url)
response.raise_for_status()

# 使用 lxml 解析 HTML
tree = html.fromstring(response.content)

# ✅ 使用 XPath 定位目标表格下的所有 tr 行
# 注意：你提供的路径中有一个拼写错误 —— 应该是 accessibility，不是 accessiblity
xpath_rows = "/html/body//article/markdown-accessibility-table[1]/table/tbody/tr"

rows = tree.xpath(xpath_rows)

proxies = []
for row in rows:
    # 获取 td 列
    tds = row.xpath(".//td")
    if len(tds) >= 3:
        try:
            proxy_type = tds[0].text_content().strip()
            
            # 提取 link：优先找 <code> 标签内的文本
            code_elements = tds[1].xpath(".//code")
            if code_elements:
                link = code_elements[0].text_content().strip()
            else:
                link = tds[1].text_content().strip()
            
            date = tds[2].text_content().strip()

            proxies.append({
                "type": proxy_type,
                "link": link,
                "date": date
            })
        except Exception as e:
            print(f"解析行失败: {e}")
            continue

# 保存数据
output_dir = "data"
os.makedirs(output_dir, exist_ok=True)
with open(f"{output_dir}/proxies.json", "w", encoding="utf-8") as f:
    json.dump(proxies, f, indent=2, ensure_ascii=False)

print(f"✅ 成功抓取 {len(proxies)} 条代理数据")
