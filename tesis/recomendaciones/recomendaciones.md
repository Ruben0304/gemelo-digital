# Recomendaciones {.unnumbered}

A partir de los resultados obtenidos y de las limitaciones reconocidas en el alcance, se formulan las siguientes recomendaciones para la continuidad del trabajo:

1. **Validar el modelo de generación con datos reales del sitio.** Una vez montado el sistema físico, llevar un registro continuo de las mediciones del equipo para comprobar el error exacto del modelo de predicción de generación frente al comportamiento real de la ubicación.

2. **Entrenar un modelo de consumo con histórico propio.** Cuando se acumule alrededor de un año o más de datos de consumo de los equipos, entrenar el modelo de consumo para obtener predicciones de la mayor exactitud posible, sin depender de introducir manualmente todas las mediciones.

3. **Mantener la estrategia de pruebas al crecer el sistema.** Cada vez que se agregue una nueva funcionalidad al proyecto, seguir el mismo patrón de clases de prueba que se aplica actualmente.

4. **Reentrenar el clasificador de limpieza con los paneles reales.** Una vez instalados los paneles del sistema, capturar fotos de ellos durante un cierto tiempo y reentrenar el modelo con esas imágenes, para hacer aún más exacta la predicción de suciedad.

5. **Validar la portabilidad en otras microrredes.** Probar el sistema en más de una microrred ya instalada para tener una mejor validación de su portabilidad.

\newpage
