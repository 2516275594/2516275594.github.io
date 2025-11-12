import requests
from bs4 import BeautifulSoup
import json
import os

# 爬取的页面
url = "https://github.com/crossxx-labs/free-proxy"

# 发送请求
response = requests.get(url)
soup = BeautifulSoup(response.text, "html.parser")

# 提取表格数据
proxies = []
table = soup.find("table")
if table:
    rows = table.find_all("tr")
    for row in rows[1:]:  # 跳过表头
        cols = row.find_all("td")
        if len(cols) >= 3:
            proxy_type = cols[0].get_text(strip=True)
            link = cols[1].find("code").get_text(strip=True)
            date = cols[2].get_text(strip=True)
            proxies.append({
                "type": proxy_type,
                "link": link,
                "date": date
            })

# 保存为 JSON 文件
output_dir = "data"
os.makedirs(output_dir, exist_ok=True)
with open(f"{output_dir}/proxies.json", "w") as f:
    json.dump(proxies, f, indent=2)

print("数据已保存到 data/proxies.json")
