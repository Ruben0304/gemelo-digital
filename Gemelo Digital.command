#!/usr/bin/env bash
# Doble clic en Finder para levantar el Gemelo Digital (modo host, sin contenedores).
ROOT="$(cd "$(dirname "$0")" && pwd)"

# Libera los puertos si hubiera procesos huérfanos
echo "▶ Liberando puertos 8000, 8001, 3000…"
for PORT in 8000 8001 3000; do
  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null) || true
  [ -n "$PIDS" ] && kill $PIDS 2>/dev/null && echo "  :$PORT → liberado" || true
done

# Abre una ventana de Terminal por servicio
osascript <<EOF
tell application "Terminal"
  -- Backend :8000
  do script "cd '${ROOT}/backend' && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000"
  set custom title of front window to "Backend :8000"
  activate

  -- Clima mock :8001
  do script "cd '${ROOT}/servidor_clima_mock' && ./venv/bin/uvicorn main:app --host 0.0.0.0 --port 8001"
  set custom title of front window to "Clima mock :8001"

  -- Frontend :3000 (build producción + start)
  do script "cd '${ROOT}/frontend' && npm run build && npm start"
  set custom title of front window to "Frontend :3000"
end tell
EOF

echo
echo "✔ Tres ventanas abiertas (backend, clima_mock, frontend)."
echo "  El frontend tarda ~1 min en compilar antes de estar disponible."
echo
echo "  Backend   → http://localhost:8000/graphql"
echo "  Clima     → http://localhost:8001"
echo "  Frontend  → http://localhost:3000"
echo
echo "── Pulsa una tecla para cerrar esta ventana ──"
read -n 1 -s
