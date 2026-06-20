#!/usr/bin/env python3
"""Captura fig2-fig5 del gemelo digital a archivos PNG (alta resolución)."""
import json
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3010"
OUT = "/Users/fabi/Proyectos/Tesis Gemelo/tesis-cujae/tesis/recursos/figuras"
AUTH = {"email":"demo@microrred.cu","name":"Operador Demo","role":"admin",
        "token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZW1vQG1pY3JvcnJlZC5jdSIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTc4MjA4MjA3MCwiaWF0IjoxNzgxNDc3MjcwfQ.zZaXfn9Q2RtERbNrvrVlx5taV12fiztDMtFy4tu6rK8"}

TAG_JS = """(args) => {
  const [text, key] = args;
  const hs=[...document.querySelectorAll('h1,h2,h3')];
  const h=hs.find(e=>e.textContent.trim().startsWith(text));
  if(!h) return 'heading no encontrado: '+text;
  let el=h;
  for(let i=0;i<8 && el.parentElement;i++){
    el=el.parentElement;
    const r=el.getBoundingClientRect();
    const cls=(typeof el.className==='string')?el.className:'';
    if(/rounded/.test(cls) && r.width>320 && r.height>180){ el.setAttribute('data-shot',key); return 'ok '+key+' w='+Math.round(r.width)+' h='+Math.round(r.height); }
  }
  h.setAttribute('data-shot',key); return 'fallback '+key;
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width":1440,"height":900}, device_scale_factor=2)
    ctx.add_init_script(f"localStorage.setItem('gd_auth_user', JSON.stringify({json.dumps(AUTH)}));")
    pg = ctx.new_page()
    pg.goto(BASE, wait_until="domcontentloaded")
    try:
        pg.get_by_role("button", name="Configurar más tarde").click(timeout=15000)
    except Exception: pass
    pg.wait_for_selector("text=Predicción ML de producción", timeout=60000)
    pg.wait_for_timeout(3500)  # que terminen animaciones de los gráficos

    # fig2 — hero / dashboard de generación (viewport superior)
    pg.evaluate("window.scrollTo(0,0)")
    pg.wait_for_timeout(400)
    pg.screenshot(path=f"{OUT}/fig2_dashboard_generacion.png", clip={"x":0,"y":0,"width":1440,"height":820})
    print("fig2 OK")

    # fig3 — gráfico producción vs consumo
    print(pg.evaluate(TAG_JS, ["Predicción ML de producción", "fig3"]))
    pg.locator('[data-shot="fig3"]').screenshot(path=f"{OUT}/fig3_grafico_generacion_consumo.png")
    print("fig3 OK")

    # fig4 — datos climáticos (clima actual + pronóstico extendido, unión de ambas tarjetas)
    # ocultar barras flotantes (fixed/sticky) para que no se cuelen en el recorte
    pg.evaluate("""() => {
      const s=document.createElement('style'); s.id='hide-floats';
      s.textContent='*{}';
      document.head.appendChild(s);
      window.__hidden=[...document.querySelectorAll('*')].filter(e=>{const p=getComputedStyle(e).position;return p==='fixed'||p==='sticky';});
      window.__hidden.forEach(e=>{e.dataset.prevVis=e.style.visibility; e.style.visibility='hidden';});
    }""")
    print(pg.evaluate(TAG_JS, ["Clima actual", "fig4a"]))
    print(pg.evaluate(TAG_JS, ["Pronóstico extendido", "fig4b"]))
    rect = pg.evaluate("""() => {
      const a=document.querySelector('[data-shot="fig4a"]');
      const b=document.querySelector('[data-shot="fig4b"]');
      if(!a) return null;
      const ra=a.getBoundingClientRect();
      const rb=b?b.getBoundingClientRect():ra;
      const x=Math.min(ra.left,rb.left), y=Math.min(ra.top,rb.top);
      const right=Math.max(ra.right,rb.right), bottom=Math.max(ra.bottom,rb.bottom);
      return {x:x+window.scrollX, y:y+window.scrollY, width:right-x, height:bottom-y};
    }""")
    if rect:
        pg.screenshot(path=f"{OUT}/fig4_datos_climaticos.png", full_page=True,
                      clip={"x":max(0,rect["x"]-8),"y":max(0,rect["y"]-8),
                            "width":rect["width"]+16,"height":rect["height"]+16})
        print("fig4 OK union", {k:round(v) for k,v in rect.items()})
    else:
        pg.locator('[data-shot="fig4a"]').screenshot(path=f"{OUT}/fig4_datos_climaticos.png")
        print("fig4 OK (solo clima actual)")
    # restaurar floats
    pg.evaluate("() => { (window.__hidden||[]).forEach(e=>{e.style.visibility=e.dataset.prevVis||'';}); const s=document.getElementById('hide-floats'); if(s) s.remove(); }")

    # fig5 — panel de administración / inventario de activos
    try:
        pg.get_by_role("button", name="Ajustes").first.click(timeout=8000)
        pg.wait_for_timeout(3500)
        pg.evaluate("window.scrollTo(0,0)")
        pg.wait_for_timeout(500)
        pg.screenshot(path=f"{OUT}/fig5_dashboard_administracion.png", clip={"x":0,"y":0,"width":1440,"height":900})
        print("fig5 OK (Ajustes)")
        # body text para confirmar contenido
        print("AJUSTES body:", pg.eval_on_selector("body","e=>e.innerText.slice(0,200)").replace("\\n"," | "))
    except Exception as e:
        print("fig5 ERROR:", str(e)[:160])
    b.close()
