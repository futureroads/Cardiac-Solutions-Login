"""Seed subscriber AED map locations into MongoDB.

Downloads the Geocoded_AED_Full_List.xlsx, geocodes each unique address via the
Google Maps Geocoding API, and upserts records into `subscriber_map_locations`.

Usage:
    python seed_map_subscribers.py

Environment:
    MONGO_URL, DB_NAME (from backend/.env)
    REACT_APP_GOOGLE_MAPS_KEY (read from frontend/.env)
"""
import asyncio
import io
import os
import sys
from pathlib import Path

import httpx
import openpyxl
from motor.motor_asyncio import AsyncIOMotorClient


SUBSCRIBER_NAME = "Georgia Power"
XLSX_URL = (
    "https://customer-assets.emergentagent.com/job_f27a3c52-bdd1-4fad-9b60-4d0d61164cfd/"
    "artifacts/975dvj39_Geocoded_AED_Full_List.xlsx"
)


def _parse_env_file(path: Path) -> dict:
    vals = {}
    if not path.exists():
        return vals
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        vals[k.strip()] = v.strip().strip('"').strip("'")
    return vals


async def geocode_address(client: httpx.AsyncClient, api_key: str, address: str):
    """Return (lat, lng) or (None, None) for the given address."""
    try:
        r = await client.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": address, "key": api_key},
            timeout=20,
        )
        j = r.json()
        if j.get("status") == "OK" and j.get("results"):
            loc = j["results"][0]["geometry"]["location"]
            return float(loc["lat"]), float(loc["lng"])
    except Exception as e:  # noqa: BLE001
        print(f"    geocode error for {address!r}: {e}")
    return None, None


async def main():
    backend_env = _parse_env_file(Path(__file__).parent / ".env")
    frontend_env = _parse_env_file(Path(__file__).parent.parent / "frontend" / ".env")

    mongo_url = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
    db_name = backend_env.get("DB_NAME") or os.environ.get("DB_NAME")
    gmaps_key = (
        frontend_env.get("REACT_APP_GOOGLE_MAPS_KEY")
        or os.environ.get("REACT_APP_GOOGLE_MAPS_KEY")
    )

    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL / DB_NAME missing")
        sys.exit(1)
    if not gmaps_key:
        print("ERROR: REACT_APP_GOOGLE_MAPS_KEY missing")
        sys.exit(1)

    # Download xlsx into memory
    print(f"Downloading {XLSX_URL} ...")
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(XLSX_URL)
        resp.raise_for_status()
        content = resp.content

    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]
    print(f"Columns: {headers}")

    def idx(name):
        try:
            return headers.index(name)
        except ValueError:
            return -1

    i_sid = idx("SentinelId")
    i_group = idx("LocationGroup")
    i_site = idx("Site")
    i_bldg = idx("Building")
    i_place = idx("PlacementLocation")
    i_addr = idx("Clean_Address")
    i_lat = idx("Latitude")
    i_lng = idx("Longitude")

    records = []
    for row in rows[1:]:
        if not row or not row[i_sid]:
            continue
        records.append({
            "sentinel_id": str(row[i_sid]).strip(),
            "location_group": str(row[i_group]).strip() if i_group >= 0 and row[i_group] else "",
            "site": str(row[i_site]).strip() if i_site >= 0 and row[i_site] else "",
            "building": str(row[i_bldg]).strip() if i_bldg >= 0 and row[i_bldg] else "",
            "placement_location": str(row[i_place]).strip() if i_place >= 0 and row[i_place] else "",
            "clean_address": str(row[i_addr]).strip() if i_addr >= 0 and row[i_addr] else "",
            "latitude": row[i_lat] if i_lat >= 0 and row[i_lat] is not None else None,
            "longitude": row[i_lng] if i_lng >= 0 and row[i_lng] is not None else None,
        })
    print(f"Parsed {len(records)} AED rows from spreadsheet.")

    # Geocode unique addresses
    unique_addrs = sorted({r["clean_address"] for r in records if r["clean_address"]})
    print(f"Unique addresses to geocode: {len(unique_addrs)}")

    addr_cache: dict[str, tuple] = {}
    async with httpx.AsyncClient(timeout=30) as client:
        for i, addr in enumerate(unique_addrs, 1):
            lat, lng = await geocode_address(client, gmaps_key, addr)
            addr_cache[addr] = (lat, lng)
            status = "OK" if lat else "FAIL"
            print(f"  [{i}/{len(unique_addrs)}] {status} {addr} -> {lat}, {lng}")
            await asyncio.sleep(0.05)

    # Attach lat/lng
    geocoded_count = 0
    for r in records:
        lat, lng = addr_cache.get(r["clean_address"], (None, None))
        if r["latitude"] is None:
            r["latitude"] = lat
        if r["longitude"] is None:
            r["longitude"] = lng
        if r["latitude"] is not None and r["longitude"] is not None:
            geocoded_count += 1
        r["subscriber"] = SUBSCRIBER_NAME

    print(f"Geocoded {geocoded_count}/{len(records)} AEDs.")

    # Store in MongoDB
    mc = AsyncIOMotorClient(mongo_url)
    db = mc[db_name]
    coll = db["subscriber_map_locations"]

    # Clear existing subscriber data so reseeds are idempotent
    del_res = await coll.delete_many({"subscriber": SUBSCRIBER_NAME})
    print(f"Removed {del_res.deleted_count} existing docs for {SUBSCRIBER_NAME}.")

    if records:
        await coll.insert_many(records)
    await coll.create_index([("subscriber", 1)])
    await coll.create_index([("sentinel_id", 1)])
    print(f"Inserted {len(records)} AED records into subscriber_map_locations.")
    mc.close()


if __name__ == "__main__":
    asyncio.run(main())
