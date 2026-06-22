## Conclusiones del capítulo

Del análisis experimental se concluye que:

- Sobre datos históricos de La Habana (reanálisis de Open-Meteo y producción estimada por PVGIS) y con separación cronológica estricta, el modelo de generación *Havana v1* alcanza un R² global de 0,8989 y un nRMSE diurno del 11,4 %, y su jerarquía de variables coincide con la física del fenómeno; predecir el factor de capacidad lo hace aplicable a cualquier tamaño de instalación.
- El clasificador de limpieza MobileNetV2 alcanza una precisión del 84,21 % y un AUC de 0,8373, con un umbral calibrado para priorizar la fiabilidad de las alertas, acorde con el mantenimiento basado en condición.
- Los casos de prueba de caja negra sobre las funciones principales arrojaron un veredicto satisfactorio, y 819 pruebas unitarias automatizadas respaldan la lógica interna del sistema.
- La operación en el escenario de la CUJAE (con clima en vivo de Open-Meteo y los parámetros del sitio) muestra que el sistema funciona en condiciones de uso; la transferibilidad a otros emplazamientos está resuelta por configuración a nivel de diseño, sin modificar el código, y su validación empírica en otras microrredes queda como vía de continuidad.

Estos resultados respaldan el cumplimiento de los objetivos y dan paso a las conclusiones generales del trabajo.
