import requests
import re
import json
import os

# 使用 raw GitHub 内容 URL
url = "https://raw.githubusercontent.com/crossxx-labs/free-proxy/refs/heads/main/README.md"
response = requests.get(url)
response.raise_for_status()

content = response.text

# ✅ 定义要匹配的行模式（支持空格、代码块、对齐等）
pattern = r'\|\s*([^|]+?)\s*\|\s*`?(https://clash\.crossxx\.com/sub/(?:ssr|vmess|hysteria)/\d+)`?\s*\|\s*([\d\-:\s]+)\s*\|'

# 查找所有匹配的行
matches = re.findall(pattern, content)

proxies = []
for match in matches:
    proxy_type = match[0].strip()        # 类型：免费 SSR / VMess / Hysteria2
    link = match[1].strip()              # 链接
    date = match[2].strip()              # 日期时间

    proxies.append({
        "type": proxy_type,
        "link": link,
        "date": date
    })

# 确保至少抓到一行
if not proxies:
    print("❌ 未找到匹配的代理数据，请检查正则或 README 内容")
else:
    print(f"✅ 成功抓取 {len(proxies)} 条代理数据")

# 保存到 data/proxies.json
output_dir = "data"
os.makedirs(output_dir, exist_ok=True)
with open(f"{output_dir}/proxies.json", "w", encoding="utf-8") as f:
    json.dump(proxies, f, indent=2, ensure_ascii=False)

print("数据已保存到 data/proxies.json")
