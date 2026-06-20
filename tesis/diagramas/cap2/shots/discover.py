#!/usr/bin/env python3
"""Descubre la estructura del dashboard para planear las capturas."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3010"
AUTH = {"email":"demo@microrred.cu","name":"Operador Demo","role":"admin",
        "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vQG1pY3JvcnJlZC5jdSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc4MjA4MjA3MCwiaWF0IjoxNzgxNDc3MjcwfQ.zZaXfn9Q2RtERbNrvrVlx5taV12fiztDMtFy4tu6rK8"}

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":1440,"height":900}, device_scale_factor=2)
    ctx.add_init_script(f"localStorage.setItem('gd_auth_user', JSON.stringify({json.dumps(AUTH)}));")
    pg = ctx.new_page()
    net = []
    pg.on("response", lambda r: net.append(f"{r.status} {r.url.split('/')[-1][:40]}") if "graphql" in r.url or "classify" in r.url else None)
    pg.on("console", lambda m: net.append(f"console.{m.type}: {m.text[:120]}") if m.type=="error" else None)
    pg.goto(BASE, wait_until="domcontentloaded")
    # descartar onboarding si aparece
    try:
        pg.get_by_role("button", name="Configurar más tarde").click(timeout=15000)
        print("onboarding descartado")
    except Exception as e:
        print("no onboarding (o ya en dashboard):", str(e)[:80])
    # esperar al dashboard real
    try:
        pg.wait_for_selector("text=Microrred Solar", timeout=60000)
        print("dashboard cargado")
    except Exception as e:
        print("dashboard NO cargó:", str(e)[:120])
    pg.wait_for_timeout(3000)
    buttons = pg.eval_on_selector_all("button", "els => els.map(e=>e.textContent.trim()).filter(Boolean)")
    headings = pg.eval_on_selector_all("h1,h2,h3", "els => els.map(e=>e.textContent.trim()).filter(Boolean)")
    bodytext = pg.eval_on_selector("body", "e => e.innerText.slice(0,400)")
    print("=== BUTTONS ==="); print(json.dumps(buttons, ensure_ascii=False))
    print("=== HEADINGS ==="); print(json.dumps(headings, ensure_ascii=False))
    print("=== NET/console ==="); print(json.dumps(net[:20], ensure_ascii=False))
    print("=== BODY TEXT (400) ==="); print(bodytext)
    pg.screenshot(path="/Users/fabi/Proyectos/Tesis Gemelo/tesis-cujae/docs/diagrams/cap2/shots/_dash_full.png", full_page=True)
    print("saved _dash_full.png")
    b.close()
