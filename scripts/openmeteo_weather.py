#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 Open-Meteo 抓取济南天气，并原子写入静态 JSON。"""

import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

LATITUDE = 36.6512
LONGITUDE = 117.1201
TIMEZONE = "Asia/Shanghai"
API_URL = "https://api.open-meteo.com/v1/forecast"
OUTPUT = Path(__file__).resolve().parents[1] / "data" / "openmeteo_weather.json"

CURRENT = [
    "temperature_2m", "relative_humidity_2m", "apparent_temperature",
    "is_day", "precipitation", "rain", "showers", "snowfall",
    "weather_code", "cloud_cover", "pressure_msl", "surface_pressure",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]
HOURLY = [
    "temperature_2m", "relative_humidity_2m", "dew_point_2m",
    "apparent_temperature", "precipitation_probability", "precipitation",
    "rain", "showers", "snowfall", "weather_code", "pressure_msl",
    "surface_pressure", "cloud_cover", "cloud_cover_low", "cloud_cover_mid",
    "cloud_cover_high", "visibility", "wind_speed_10m",
    "wind_direction_10m", "wind_gusts_10m", "uv_index", "is_day",
]
DAILY = [
    "weather_code", "temperature_2m_max", "temperature_2m_min",
    "apparent_temperature_max", "apparent_temperature_min", "sunrise",
    "sunset", "daylight_duration", "sunshine_duration", "uv_index_max",
    "precipitation_sum", "rain_sum", "showers_sum", "snowfall_sum",
    "precipitation_hours", "precipitation_probability_max",
    "wind_speed_10m_max", "wind_gusts_10m_max",
    "wind_direction_10m_dominant", "cloud_cover_mean", "cloud_cover_max",
]


def main():
    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "timezone": TIMEZONE,
        "forecast_days": 16,
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
        "current": ",".join(CURRENT),
        "hourly": ",".join(HOURLY),
        "daily": ",".join(DAILY),
        "timeformat": "iso8601",
    }
    response = requests.get(
        API_URL,
        params=params,
        headers={"User-Agent": "JinanWeatherGitHubActions/1.0"},
        timeout=(10, 45),
    )
    response.raise_for_status()
    payload = response.json()

    for section in ("current", "hourly", "daily"):
        if not isinstance(payload.get(section), dict):
            raise RuntimeError(f"Open-Meteo 响应缺少 {section} 数据")
    if not payload["hourly"].get("time") or not payload["daily"].get("time"):
        raise RuntimeError("Open-Meteo 返回的逐小时或逐日数据为空")
    if len(payload["daily"]["time"]) < 7:
        raise RuntimeError("Open-Meteo 逐日预报少于 7 天，拒绝覆盖旧数据")
    if not isinstance(payload["current"].get("temperature_2m"), (int, float)):
        raise RuntimeError("Open-Meteo 当前温度无效，拒绝覆盖旧数据")

    payload["source"] = "Open-Meteo"
    payload["source_url"] = response.url
    payload["fetched_at"] = datetime.now(ZoneInfo(TIMEZONE)).isoformat(timespec="seconds")
    payload["city"] = "济南"
    payload["attribution"] = "Weather data by Open-Meteo (CC BY 4.0)"

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temp_path = OUTPUT.with_suffix(".json.tmp")
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp_path, OUTPUT)

    current = payload["current"]
    daily = payload["daily"]
    hourly_count = len(payload["hourly"]["time"])
    print(
        f"Open-Meteo 抓取成功：济南 {current['temperature_2m']}°C，"
        f"云量 {current.get('cloud_cover')}%，当前降水 {current.get('precipitation')} mm；"
        f"{len(daily['time'])} 天预报、{hourly_count} 个小时数据。"
    )


if __name__ == "__main__":
    main()
