#!/usr/bin/env bash
#
# Levanta (o detiene) el Gemelo Digital con Apple `container` en lugar de Docker.
# Replica el docker-compose.yml usando una red propia para que los servicios
# se resuelvan por nombre (mongodb, backend, clima_mock).
#
# Uso:
#   ./container-up.sh up      # construye y arranca todo (por defecto)
#   ./container-up.sh down    # detiene y elimina los contenedores
#   ./container-up.sh logs    # sigue los logs del backend y frontend
#
set -euo pipefail

cd "$(dirname "$0")"

NET="gd-net"
JWT_SECRET="${JWT_SECRET:-gemelo-digital-cujae-secret-key-2024}"

# Puertos expuestos en el host (puedes sobreescribirlos por entorno).
PORT_FRONTEND="${PORT_FRONTEND:-3000}"
PORT_BACKEND="${PORT_BACKEND:-8000}"
PORT_CLIMA="${PORT_CLIMA:-8001}"
PORT_MONGO="${PORT_MONGO:-27017}"

NAMES=(frontend backend clima_mock mongodb)

down() {
  echo "▶ Deteniendo contenedores…"
  container stop "${NAMES[@]}" 2>/dev/null || true
  container rm   "${NAMES[@]}" 2>/dev/null || true
  echo "✔ Listo."
}

up() {
  echo "▶ Arrancando el sistema de Apple container…"
  container system start 2>/dev/null || true

  echo "▶ Asegurando la red '$NET'…"
  container network create "$NET" 2>/dev/null || true

  # Empezamos limpio para evitar choques de nombres.
  down >/dev/null 2>&1 || true

  echo "▶ [1/4] MongoDB…"
  container run -d --name mongodb --network "$NET" \
    -p "${PORT_MONGO}:27017" \
    -e MONGO_INITDB_DATABASE=GemeloDigitalCujai \
    mongo:7

  echo "▶ [2/4] Construyendo y arrancando clima_mock…"
  container build -t gd-clima ./servidor_clima_mock
  container run -d --name clima_mock --network "$NET" \
    -p "${PORT_CLIMA}:8001" \
    gd-clima

  echo "▶ [3/4] Construyendo y arrancando backend…"
  container build -t gd-backend ./backend
  container run -d --name backend --network "$NET" \
    -p "${PORT_BACKEND}:8000" \
    -e MONGODB_URI="mongodb://mongodb:27017/GemeloDigitalCujai" \
    -e MONGODB_DB=GemeloDigitalCujai \
    -e CORS_ORIGINS="http://localhost:${PORT_FRONTEND}" \
    -e JWT_SECRET="$JWT_SECRET" \
    gd-backend

  echo "▶ [4/4] Construyendo y arrancando frontend…"
  container build -t gd-frontend \
    --build-arg NEXT_PUBLIC_GRAPHQL_URL="http://localhost:${PORT_BACKEND}/graphql" \
    --build-arg NEXT_PUBLIC_API_URL="http://localhost:${PORT_BACKEND}" \
    ./frontend
  container run -d --name frontend --network "$NET" \
    -p "${PORT_FRONTEND}:3000" \
    gd-frontend

  echo
  echo "✔ Todo en marcha:"
  container ls
  echo
  echo "  Frontend  → http://localhost:${PORT_FRONTEND}"
  echo "  Backend   → http://localhost:${PORT_BACKEND}/graphql"
  echo "  Clima     → http://localhost:${PORT_CLIMA}"
}

case "${1:-up}" in
  up)   up ;;
  down) down ;;
  logs) container logs -f backend & container logs -f frontend & wait ;;
  *)    echo "Uso: $0 {up|down|logs}"; exit 1 ;;
esac
