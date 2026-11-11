#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""抓取济南 2345 天气：实时天气 + 未来多日预报。"""

import json
import re
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

CITY = "济南"
CITY_CODE = "54823"
REALTIME_URL = f"https://tianqi.2345.com/jinan1d/{CITY_CODE}.htm"
FORECAST_URL = f"https://tianqi.2345.com/jinan/{CITY_CODE}.htm"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "jinan_weather.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://tianqi.2345.com/",
}

DATE_RE = re.compile(r"(?:(20\d{2})\s*[年./-]\s*)?(\d{1,2})\s*[月./-]\s*(\d{1,2})\s*日?")
TEMP_RE = re.compile(r"(-?\d{1,2})\s*(?:℃|°C|°)?\s*(?:~|～|至|—|－|/|到)\s*(-?\d{1,2})\s*(?:℃|°C|°)")
WEATHER_RE = re.compile(
    r"(晴|多云|阴|小雨|中雨|大雨|暴雨|阵雨|雷阵雨|雷雨|雨夹雪|小雪|中雪|大雪|暴雪|雾|霾|扬沙|浮尘|沙尘暴|冰雹)"
    r"(?:转(晴|多云|阴|小雨|中雨|大雨|暴雨|阵雨|雷阵雨|雷雨|雨夹雪|小雪|中雪|大雪|暴雪|雾|霾))?"
)
WIND_RE = re.compile(r"((?:东北|东南|西北|西南|东|南|西|北)风(?:转(?:东北|东南|西北|西南|东|南|西|北)风)?)\s*(\d+级|微风)?")


def fetch_soup(url: str) -> BeautifulSoup:
    response = requests.get(url, headers=HEADERS, timeout=25)
    response.raise_for_status()
    # 2345 页面可能不是 UTF-8；使用检测到的编码，避免中文乱码。
    response.encoding = response.apparent_encoding or "utf-8"
    return BeautifulSoup(response.text, "html.parser")


def parse_realtime(soup: BeautifulSoup) -> dict:
    block = soup.find("div", class_="today-weather")
    text = block.get_text("\n", strip=True) if block else soup.get_text("\n", strip=True)

    def one(pattern):
        match = re.search(pattern, text)
        return match.group(1) if match else None

    temp_weather = re.search(r"(\d+)\s*°\s*\n?\s*([\u4e00-\u9fa5]+)", text)
    today = re.search(r"今天：\s*(\d+)\s*[-~～]\s*(\d+)\s*°?\s*([\u4e00-\u9fa5]+)", text)
    yesterday = re.search(r"昨天：\s*(\d+)\s*[~～-]\s*(\d+)\s*°?\s*([\u4e00-\u9fa5]+)", text)
    wind = re.search(r"((?:东北|东南|西北|西南|东|南|西|北)风)\s*(\d+级)", text)
    aqi = re.search(r"(优|良|轻度污染|中度污染|重度污染|严重污染)\s*(\d{1,3})", text)

    return {
        "temperature": temp_weather.group(1) if temp_weather else None,
        "weather": temp_weather.group(2) if temp_weather else None,
        "publish_time": one(r"实时天气：\s*(\d{1,2}:\d{2})发布"),
        "today_range": f"{today.group(1)}~{today.group(2)}℃" if today else None,
        "today_weather": today.group(3) if today else None,
        "yesterday_range": f"{yesterday.group(1)}~{yesterday.group(2)}℃" if yesterday else None,
        "yesterday_weather": yesterday.group(3) if yesterday else None,
        "wind_direction": wind.group(1) if wind else None,
        "wind_level": wind.group(2) if wind else None,
        "humidity": one(r"湿度\s*(\d+%)"),
        "ultraviolet": one(r"紫外线\s*([\u4e00-\u9fa5]+)"),
        "pressure": one(r"气压\s*(\d+hPa)"),
        "sunrise": one(r"日出\s*(\d{1,2}:\d{2})"),
        "sunset": one(r"日落\s*(\d{1,2}:\d{2})"),
        "air_quality": {
            "level": aqi.group(1) if aqi else None,
            "aqi": aqi.group(2) if aqi else None,
        },
    }


def parse_date(text: str):
    match = DATE_RE.search(text)
    if not match:
        return None
    year, month, day = match.groups()
    now = datetime.now()
    year = int(year) if year else now.year
    month, day = int(month), int(day)
    if not match.group(1) and month < now.month - 6:
        year += 1
    try:
        return datetime(year, month, day).strftime("%Y-%m-%d")
    except ValueError:
        return None


def parse_daily_item(text: str):
    date = parse_date(text)
    # 先移除日期，避免把“11月11日”中的 11-11 误识别为温度范围。
    text_without_date = DATE_RE.sub(" ", text, count=1)
    temp = TEMP_RE.search(text_without_date)
    weather = WEATHER_RE.search(text)
    if not (date and temp and weather):
        return None
    a, b = int(temp.group(1)), int(temp.group(2))
    wind = WIND_RE.search(text)
    desc = weather.group(1) + ("转" + weather.group(2) if weather.group(2) else "")
    weekday = "一二三四五六日"[datetime.strptime(date, "%Y-%m-%d").weekday()]
    return {
        "date": date,
        "weekday": weekday,
        "weather": desc,
        "temp_min": min(a, b),
        "temp_max": max(a, b),
        "wind": (wind.group(1) + (wind.group(2) or "")) if wind else None,
    }


def parse_daily_forecast(soup: BeautifulSoup) -> list:
    """只遍历一次页面文本，避免逐层读取嵌套 div 导致性能问题。"""
    lines = [x.strip() for x in soup.get_text("\\n", strip=True).splitlines() if x.strip()]
    candidates = []
    for i, line in enumerate(lines):
        if not DATE_RE.search(line):
            continue
        # 2345 会把日期、天气、温度、风力拆成相邻节点，组合附近文本再解析。
        window = " ".join(lines[i:i + 18])
        item = parse_daily_item(window)
        if item:
            candidates.append((len(window), item))

    by_date = {}
    for length, item in sorted(candidates, key=lambda x: x[0]):
        by_date.setdefault(item["date"], item)
    result = sorted(by_date.values(), key=lambda x: x["date"])
    if not result:
        raise RuntimeError("未能从 2345 多日预报页面识别出日期、天气和带温度单位的温度范围；为避免覆盖旧数据，本次不写入 JSON。")
    return result[:15]


def main():
    realtime_soup = fetch_soup(REALTIME_URL)
    forecast_soup = fetch_soup(FORECAST_URL)
    realtime = parse_realtime(realtime_soup)
    daily = parse_daily_forecast(forecast_soup)

    payload = {
        "city": CITY,
        "city_code": CITY_CODE,
        "source": "2345天气",
        "source_url": REALTIME_URL,
        "forecast_source_url": FORECAST_URL,
        "crawl_time": datetime.now().astimezone().isoformat(timespec="seconds"),
        "realtime": realtime,
        "daily_forecast": daily,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已抓取 {CITY} 实时天气，识别到 {len(daily)} 天预报，写入 {OUTPUT}")


if __name__ == "__main__":
    main()
