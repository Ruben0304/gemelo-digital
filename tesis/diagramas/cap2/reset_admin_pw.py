#!/usr/bin/env python3
"""Resetea la contraseña del admin demo@microrred.cu a un valor temporal conocido
usando el mismo esquema scrypt del backend (n=2**14, r=8, p=1, dklen=64)."""
from hashlib import scrypt
from secrets import token_bytes
import pymongo, re, os

NEW_PW = "Demo2026!"
ENV = os.path.join(os.path.dirname(__file__), "..", "..", "..",
                   "tesis_gemelo_digital", "backend", ".env")

def hash_pw(p: str) -> str:
    salt = token_bytes(16)
    d = scrypt(p.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return f"{salt.hex()}:{d.hex()}"

uri = "mongodb://localhost:27017"
try:
    with open(ENV) as f:
        for line in f:
            m = re.match(r"\s*MONGODB_URI\s*=\s*(.+)", line)
            if m:
                uri = m.group(1).strip().strip('"').strip("'")
                break
except FileNotFoundError:
    pass

cli = pymongo.MongoClient(uri)
db = cli["GemeloDigitalCujai"]
res = db.usuarios.update_one(
    {"email": "demo@microrred.cu"},
    {"$set": {"passwordHash": hash_pw(NEW_PW)}},
)
print("matched", res.matched_count, "modified", res.modified_count)
print("password set to:", NEW_PW)
