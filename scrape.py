import requests
from bs4 import BeautifulSoup
import json
import os

url = "https://github.com/crossxx-labs/free-proxy"

response = requests.get(url)
response.raise_for_status()
soup = BeautifulSoup(response.text, "html.parser")

# ✅ 定位 .markdown-body 中的所有 <table>
markdown_body = soup.find("div", class_="markdown-body")
if not markdown_body:
    print("未找到 .markdown-body")
    exit()

tables = markdown_body.find_all("table")

# ✅ 取第 7 个表格（索引为 6）
target_table = tables[6] if len(tables) >= 7 else None

proxies = []
if target_table:
    rows = target_table.find_all("tr")
    for row in rows[1:]:  # 跳过表头
        cols = row.find_all("td")
        if len(cols) >= 3:
            try:
                proxy_type = cols[0].get_text(strip=True)
                
                # 安全提取 link：优先找 <code>，否则用文本
                code_tag = cols[1].find("code")
                link = code_tag.get_text(strip=True) if code_tag else cols[1].get_text(strip=True)
                
                date = cols[2].get_text(strip=True)
                
                proxies.append({
                    "type": proxy_type,
                    "link": link,
                    "date": date
                })
            except Exception as e:
                print(f"解析行失败: {e}")
                continue
else:
    print("未找到第 7 个表格")

# 保存数据
output_dir = "data"
os.makedirs(output_dir, exist_ok=True)
with open(f"{output_dir}/proxies.json", "w") as f:
    json.dump(proxies, f, indent=2)

print(f"成功抓取 {len(proxies)} 条数据")
