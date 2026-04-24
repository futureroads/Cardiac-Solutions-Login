"""Re-geocode every AED in `subscriber_map_locations` using the Google Maps
Geocoding API (requires an unrestricted server key in
`GOOGLE_MAPS_SERVER_KEY`).

Strategy per address:
  1. Try the raw `clean_address` (preferred — gives ROOFTOP when possible).
  2. If the result is APPROXIMATE, try removing anything after the first
     comma-delimited token (i.e. use just "<street>, <city>, <state>") — some
     addresses carry a campus name that confuses geocoder.
  3. Always store the best lat/lng + `location_type` so we can see precision.

Existing lat/lng in the collection is overwritten when a better hit is found.
If the API returns nothing at all we keep the previous coordinates.

Usage:  python regeocode_map.py
"""
import asyncio
import os
import re
from pathlib import Path

import httpx
from motor.motor_asyncio import AsyncIOMotorClient


GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


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


def _simplify(addr: str) -> str:
    """Drop a campus / building-name token if present.

    Example: '205 Dairy Pak Road, Athens Operations HQ, GA'
        -> '205 Dairy Pak Road, Athens, GA'
    """
    parts = [p.strip() for p in addr.split(",")]
    if len(parts) < 3:
        return addr
    # Middle token: strip trailing 'HQ', 'Operations HQ', etc.
    middle = parts[1]
    middle = re.sub(r"\s+(Operations|Distribution|Dist|HQ|Complex|Facility|Plant|Center|Office|Building)(\s+HQ)?\b",
                    "", middle, flags=re.IGNORECASE)
    middle = middle.strip()
    if middle:
        parts[1] = middle
    return ", ".join(parts)


async def _geocode_once(client: httpx.AsyncClient, key: str, address: str):
    try:
        r = await client.get(
            GEOCODE_URL,
            params={"address": address, "key": key, "region": "us"},
            timeout=25,
        )
        if r.status_code != 200:
            return None
        d = r.json()
        if d.get("status") != "OK" or not d.get("results"):
            return None
        top = d["results"][0]
        loc = top["geometry"]["location"]
        return {
            "lat": float(loc["lat"]),
            "lng": float(loc["lng"]),
            "location_type": top["geometry"].get("location_type", "UNKNOWN"),
            "formatted_address": top.get("formatted_address", ""),
        }
    except Exception as e:  # noqa: BLE001
        print(f"    ERROR {address!r}: {e}")
        return None


async def geocode_best(client: httpx.AsyncClient, key: str, address: str):
    hit = await _geocode_once(client, key, address)
    simplified = _simplify(address)
    if simplified != address:
        alt = await _geocode_once(client, key, simplified)
        if alt and alt["location_type"] in {"ROOFTOP", "RANGE_INTERPOLATED"} and (
            not hit or hit["location_type"] not in {"ROOFTOP", "RANGE_INTERPOLATED"}
        ):
            return alt, simplified
    return hit, address


async def main():
    backend_env = _parse_env(Path(__file__).parent / ".env")
    mongo_url = backend_env.get("MONGO_URL") or os.environ.get("MONGO_URL")
    db_name = backend_env.get("DB_NAME") or os.environ.get("DB_NAME")
    key = backend_env.get("GOOGLE_MAPS_SERVER_KEY") or os.environ.get("GOOGLE_MAPS_SERVER_KEY")
    if not mongo_url or not db_name:
        raise SystemExit("MONGO_URL / DB_NAME missing")
    if not key:
        raise SystemExit("GOOGLE_MAPS_SERVER_KEY missing from backend/.env")

    mc = AsyncIOMotorClient(mongo_url)
    db = mc[db_name]
    coll = db["subscriber_map_locations"]

    addrs = sorted({a for a in await coll.distinct("clean_address") if a})
    print(f"Unique addresses to geocode: {len(addrs)}")

    counters = {"ROOFTOP": 0, "RANGE_INTERPOLATED": 0, "GEOMETRIC_CENTER": 0, "APPROXIMATE": 0, "MISS": 0}
    updates: dict[str, dict] = {}

    async with httpx.AsyncClient() as client:
        for i, addr in enumerate(addrs, 1):
            result, used = await geocode_best(client, key, addr)
            if result is None:
                counters["MISS"] += 1
                print(f"  [{i:3}/{len(addrs)}] MISS    {addr}")
                continue
            counters[result["location_type"]] = counters.get(result["location_type"], 0) + 1
            updates[addr] = {**result, "used_query": used}
            tag = result["location_type"]
            print(
                f"  [{i:3}/{len(addrs)}] {tag:20} {addr}  ->  "
                f"{result['lat']:.6f}, {result['lng']:.6f}  ({result['formatted_address']})"
            )
            await asyncio.sleep(0.06)  # stay well under the free quota rate

    # Apply updates
    docs_updated = 0
    for addr, r in updates.items():
        res = await coll.update_many(
            {"clean_address": addr},
            {"$set": {
                "latitude": r["lat"],
                "longitude": r["lng"],
                "geocode_source": "google",
                "geocode_precision": r["location_type"],
                "formatted_address": r["formatted_address"],
            }},
        )
        docs_updated += res.modified_count

    print("\n=== Summary ===")
    for k, v in counters.items():
        print(f"  {k}: {v}")
    print(f"AED documents updated: {docs_updated}")
    mc.close()


if __name__ == "__main__":
    asyncio.run(main())
