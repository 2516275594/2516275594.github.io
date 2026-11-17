#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按批次抓取中国天气网全国地级市天气，发布为 GitHub Pages 静态 JSON。"""
import json, os, re, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "weathercom_cities.json"
INDEX_URL = "https://j.i8tq.com/weather2020/search/city.js"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Referer": "https://www.weather.com.cn/",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}
TZ = ZoneInfo("Asia/Shanghai")
BATCH_SIZE = int(os.getenv("WEATHERCOM_BATCH_SIZE", "60"))
WORKERS = 2

def now_iso():
    return datetime.now(TZ).isoformat(timespec="seconds")

def norm(s):
    return re.sub(r"(特别行政区|自治区|自治州|地区|省|市|盟|县|区)$", "", str(s or "").strip())

def get_json(url, timeout=18):
    r = requests.get(url, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    return r.json()

def parse_city_index():
    r = requests.get(INDEX_URL, headers=HEADERS, timeout=25)
    r.raise_for_status()
    source = r.text
    start, end = source.find("{"), source.rfind("}")
    if start < 0 or end <= start:
        raise RuntimeError("中国天气网城市编码表格式异常")
    raw = json.loads(source[start:end + 1])
    result = []
    for province, cities in raw.items():
        if province.startswith(("香港", "澳门", "台湾")) or not isinstance(cities, dict):
            continue
        for city, areas in cities.items():
            if city.startswith(("香港", "澳门", "台湾", "钓鱼岛")) or not isinstance(areas, dict):
                continue
            candidates = []
            if areas.get("AREAID"):
                candidates.append((city, areas))
            else:
                for district, item in areas.items():
                    if isinstance(item, dict) and item.get("AREAID"):
                        candidates.append((district, item))
            if not candidates:
                continue
            # 优先使用城市同名编码；没有时使用市辖区或列表中的首个中心城区编码。
            selected = next((x for x in candidates if norm(x[0]) == norm(city) or norm(x[1].get("NAMECN")) == norm(city)), None)
            if not selected:
                selected = next((x for x in candidates if "市辖区" in x[0]), candidates[0])
            district, item = selected
            result.append({
                "name": str(city),
                "province": str(province),
                "code": str(item["AREAID"]),
                "district": str(district),
            })
    # 城市名去重，优先保留更直接的编码条目。
    unique = {}
    for item in result:
        unique.setdefault(item["name"], item)
    cities = sorted(unique.values(), key=lambda x: (x["province"], x["name"]))
    if len(cities) < 250:
        raise RuntimeError(f"城市编码表解析数量异常：仅识别到 {len(cities)} 个城市")
    return cities

def num(value):
    m = re.search(r"-?\d+(?:\.\d+)?", str(value or ""))
    return float(m.group()) if m else None

def weather_code(text):
    s = str(text or "")
    if "雷" in s: return 95
    if any(x in s for x in ("暴雨", "大暴雨", "特大暴雨", "大雨")): return 65
    if "中雨" in s: return 63
    if "雨" in s: return 61
    if any(x in s for x in ("暴雪", "大雪")): return 75
    if "中雪" in s: return 73
    if "雪" in s: return 71
    if any(x in s for x in ("雾", "霾", "沙尘", "扬沙", "浮尘")): return 45
    if "阴" in s: return 3
    if "多云" in s: return 2
    if "晴" in s: return 0
    return 3

def wind_degrees(text):
    s = str(text or "")
    for key, value in (("东北",45),("东南",135),("西南",225),("西北",315),("东风",90),("南风",180),("西风",270),("北风",0)):
        if key in s: return value
    return None

def fetch_city(city):
    code = city["code"]
    stamp = int(time.time() * 1000)
    current_url = f"https://d1.weather.com.cn/sk_2d/{code}.html?_={stamp}"
    r = requests.get(current_url, headers=HEADERS, timeout=18)
    r.raise_for_status()
    raw = r.text
    a, b = raw.find("{"), raw.rfind("}")
    if a < 0 or b <= a:
        raise RuntimeError("实况数据格式异常")
    current = json.loads(raw[a:b + 1])
    if str(current.get("city")) != code or current.get("temp") is None:
        raise RuntimeError("实况城市编码不匹配或温度缺失")

    forecast_url = f"https://www.weather.com.cn/weather/{code}.shtml"
    fr = requests.get(forecast_url, headers=HEADERS, timeout=20)
    fr.raise_for_status()
    soup = BeautifulSoup(fr.content, "html.parser")
    daily = []
    today = datetime.now(TZ).date()
    for li in soup.find_all("li"):
        h = li.find(["h1", "h2"])
        wea = li.find("p", class_="wea")
        tem = li.find("p", class_="tem")
        if not (h and wea and tem):
            continue
        date_text = h.get_text(" ", strip=True)
        day_match = re.search(r"(\d{1,2})", date_text)
        if not day_match:
            continue
        day = int(day_match.group(1))
        month = today.month
        year = today.year
        candidate = datetime(year, month, min(day, 28), tzinfo=TZ).date()
        if candidate < today.replace(day=max(1, today.day - 3)):
            month += 1
            if month > 12:
                month = 1
                year += 1
        try:
            date = datetime(year, month, day, tzinfo=TZ).date().isoformat()
        except ValueError:
            continue
        desc = wea.get_text(" ", strip=True)
        temp_text = tem.get_text(" ", strip=True)
        temps = re.findall(r"-?\d+(?:\.\d+)?", temp_text)
        wind_node = li.find("p", class_="win")
        wind = wind_node.get_text(" ", strip=True) if wind_node else ""
        if not desc:
            continue
        daily.append({
            "date": date,
            "weather_code": weather_code(desc),
            "max": float(temps[0]) if temps else None,
            "min": float(temps[1]) if len(temps) > 1 else None,
            "wind": wind,
            "direction": wind_degrees(wind),
        })
        if len(daily) >= 7:
            break
    if not daily:
        raise RuntimeError("逐日预报解析失败")

    fetched = now_iso()
    data = {
        "fetchedAt": fetched,
        "timezone": "Asia/Shanghai",
        "current": {
            "time": fetched,
            "temperature_2m": num(current.get("temp")),
            "relative_humidity_2m": num(current.get("SD")),
            "apparent_temperature": None,
            "is_day": True,
            "precipitation": num(current.get("rain")),
            "weather_code": weather_code(current.get("weather")),
            "wind_speed_10m": num(current.get("wse")),
            "wind_direction_10m": wind_degrees(current.get("WD")),
            "wind_direction_text": current.get("WD") or "--",
            "wind_gusts_10m": None,
            "pressure_msl": num(current.get("qy")),
            "cloud_cover": None,
            "ultraviolet_text": "--",
        },
        "daily": {
            "time": [x["date"] for x in daily],
            "weather_code": [x["weather_code"] for x in daily],
            "temperature_2m_max": [x["max"] for x in daily],
            "temperature_2m_min": [x["min"] for x in daily],
            "apparent_temperature_max": [None for _ in daily],
            "apparent_temperature_min": [None for _ in daily],
            "sunrise": ["" for _ in daily],
            "sunset": ["" for _ in daily],
            "sunshine_duration": [None for _ in daily],
            "uv_index_max": [None for _ in daily],
            "precipitation_probability_max": [None for _ in daily],
            "precipitation_sum": [None for _ in daily],
            "wind_gusts_10m_max": [None for _ in daily],
            "wind_direction_10m_dominant": [x["direction"] for x in daily],
            "wind_text": [x["wind"] for x in daily],
        },
        "hourly": {"time": []},
    }
    return city["name"], {
        "location": {"name": city["name"], "admin1": city["province"], "country": "中国", "code": code},
        "data": data,
        "fetchedAt": fetched,
        "provider": "中国天气网",
    }

def main():
    cities = parse_city_index()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    old = {}
    cursor = 0
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            old = previous.get("cities", {}) if isinstance(previous.get("cities"), dict) else {}
            cursor = int(previous.get("cursor", 0)) % len(cities)
        except Exception:
            old, cursor = {}, 0
    full = os.getenv("WEATHERCOM_FULL_REFRESH", "false").lower() == "true" or not old
    selected = cities if full else [cities[(cursor + i) % len(cities)] for i in range(min(BATCH_SIZE, len(cities)))]
    successes, failures = {}, []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(fetch_city, city): city for city in selected}
        for future in as_completed(futures):
            city = futures[future]
            try:
                name, payload = future.result()
                successes[name] = payload
                print(f"OK {name} ({city['code']})")
            except Exception as exc:
                failures.append({"city": city["name"], "error": str(exc)[:180]})
                print(f"FAIL {city['name']}: {exc}")
    if not successes and not old:
        raise RuntimeError("本批次所有城市天气抓取失败，未生成数据文件")
    old.update(successes)
    next_cursor = 0 if full else (cursor + len(selected)) % len(cities)
    output = {
        "ok": True,
        "provider": "中国天气网",
        "source": "https://www.weather.com.cn/",
        "updatedAt": now_iso(),
        "cityCount": len(cities),
        "availableCount": len(old),
        "cursor": next_cursor,
        "batchSize": len(selected),
        "updatedThisRun": len(successes),
        "failedThisRun": failures,
        "cities": old,
    }
    temp = OUTPUT.with_suffix(".json.tmp")
    temp.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    os.replace(temp, OUTPUT)
    print(f"发布准备完成：本轮成功 {len(successes)}/{len(selected)}，累计 {len(old)}/{len(cities)}，下一轮游标 {next_cursor}")
    if len(successes) == 0:
        raise RuntimeError("本批次没有成功更新任何城市")

if __name__ == "__main__":
    main()
