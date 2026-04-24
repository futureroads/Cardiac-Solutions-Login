"""Re-geocode every AED in `subscriber_map_locations` using OpenStreetMap
Nominatim for higher accuracy than the 4-decimal coords originally in the
spreadsheet. If Nominatim cannot resolve an address we keep the previous
coordinates.

Usage:  python regeocode_map.py
"""
import asyncio
import os
from pathlib import Path

import httpx
from motor.motor_asyncio import AsyncIOMotorClient


NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "CardiacSolutionsMapSeed/1.0 (contact: support@cardiac-solutions.net)"
RATE_LIMIT_SEC = 1.05  # Nominatim requires <= 1 rps


def _parse_env(path: Path) -> dict:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


async def nominatim_geocode(client: httpx.AsyncClient, address: str):
    """Return (lat, lng, source) for the given address or (None, None, None)."""
    try:
        r = await client.get(
            NOMINATIM_URL,
            params={
                "q": address,
                "format": "json",
                "limit": 1,
                "countrycodes": "us",
                "addressdetails": 0,
            },
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US"},
            timeout=25,
        )
        if r.status_code != 200:
            return None, None, None
        arr = r.json()
        if not arr:
            return None, None, None
        top = arr[0]
        return float(top["lat"]), float(top["lon"]), top.get("type") or "nominatim"
    except Exception as e:  # noqa: BLE001
        print(f"    ERROR for {address!r}: {e}")
        return None, None, None


async def main():
    backend_env = _parse_env(Path(__file__).parent / ".env")
    mongo_url = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
    db_name = backend_env.get("DB_NAME") or os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL / DB_NAME missing")

    mc = AsyncIOMotorClient(mongo_url)
    db = mc[db_name]
    coll = db["subscriber_map_locations"]

    # Gather distinct addresses in the collection
    all_addrs = await coll.distinct("clean_address")
    addrs = [a for a in all_addrs if a]
    print(f"Unique addresses to geocode via Nominatim: {len(addrs)}")

    updates: dict[str, tuple[float, float, str]] = {}
    async with httpx.AsyncClient() as client:
        for i, addr in enumerate(addrs, 1):
            lat, lng, source = await nominatim_geocode(client, addr)
            if lat is not None:
                updates[addr] = (lat, lng, source)
                print(f"  [{i}/{len(addrs)}] OK ({source}) {addr} -> {lat:.6f}, {lng:.6f}")
            else:
                print(f"  [{i}/{len(addrs)}] MISS    {addr}")
            await asyncio.sleep(RATE_LIMIT_SEC)

    # Apply updates to every AED doc with that address
    updated = 0
    for addr, (lat, lng, source) in updates.items():
        res = await coll.update_many(
            {"clean_address": addr},
            {"$set": {
                "latitude": lat,
                "longitude": lng,
                "geocode_source": source,
                "geocode_precision": "nominatim",
            }},
        )
        updated += res.modified_count

    print(
        f"\nResolved {len(updates)}/{len(addrs)} addresses. "
        f"Updated {updated} AED documents."
    )
    mc.close()


if __name__ == "__main__":
    asyncio.run(main())
