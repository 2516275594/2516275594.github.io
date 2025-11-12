import requests
from bs4 import BeautifulSoup
import json
import os

url = "https://github.com/crossxx-labs/free-proxy"

response = requests.get(url)
response.raise_for_status()
soup = BeautifulSoup(response.text, "html.parser")

# ✅ 精确定位目标表格（使用 class 或 id）
target_table = soup.find("table", class_="markdown-heading")

proxies = []
if target_table:
    rows = target_table.find_all("tr")
    for row in rows[1:]:  # 跳过表头
        cols = row.find_all("td")
        if len(cols) >= 3:
            try:
                proxy_type = cols[0].get_text(strip=True)
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
    print("未找到目标表格")

# 保存数据
output_dir = "data"
os.makedirs(output_dir, exist_ok=True)
with open(f"{output_dir}/proxies.json", "w") as f:
    json.dump(proxies, f, indent=2)

print("数据已保存到 data/proxies.json")
