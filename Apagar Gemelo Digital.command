#!/usr/bin/env bash
# Doble clic en Finder para detener el Gemelo Digital (modo host).
echo "▶ Deteniendo servicios en puertos 8000, 8001 y 3000…"
for PORT in 8000 8001 3000; do
  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null) || true
  if [ -n "$PIDS" ]; then
    kill $PIDS 2>/dev/null && echo "  :$PORT → detenido (PID $PIDS)"
  else
    echo "  :$PORT → ya libre"
  fi
done
echo "✔ Listo."
echo
echo "── Pulsa una tecla para cerrar esta ventana ──"
read -n 1 -s
