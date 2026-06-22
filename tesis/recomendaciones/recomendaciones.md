# Recomendaciones {.unnumbered}

El sistema desarrollado cumple los objetivos planteados y queda preparado para su evolución. A partir de los resultados obtenidos y de las limitaciones reconocidas en el alcance, se formulan las siguientes recomendaciones para la continuidad del trabajo:

1. **Recopilar datos reales de operación de la microrred de la CUJAE y validar el sistema en su entorno.** La evaluación de este trabajo se apoyó en datos históricos de la región y en conjuntos de datos públicos, y la operación se demostró configurada para la CUJAE con clima en vivo; no fue posible contrastar las predicciones de generación y de consumo, la estimación de autonomía y las alertas contra mediciones propias de la microrred porque ese histórico de operación aún no se había recopilado en el emplazamiento. Se recomienda, como paso prioritario, instrumentar la instalación y reunir un conjunto representativo de datos reales (generación, consumo y estado de carga a lo largo de varias estaciones); con él podrán reentrenarse y revalidarse los modelos y comprobarse el sistema completo frente a esas mediciones, lo que cuantificará su exactitud en el emplazamiento concreto y cerrará la validación que aquí quedó pendiente por la ausencia de esos datos.

2. **Integrar sensores físicos en tiempo real y entrenar un modelo de consumo propio.** Incorporar la adquisición directa de telemetría desde la microrred mediante protocolos industriales (por ejemplo, Modbus o MQTT), para que el gemelo digital opere sobre lecturas medidas en lugar de la estimación a partir del clima y cierre por completo el lazo de monitoreo entre el sistema físico y su réplica virtual. Con la telemetría de demanda así acumulada, sustituir además el algoritmo de perfiles configurables por un modelo de aprendizaje automático de consumo entrenado con datos propios, aprovechando el diseño modular que ya contempla esa sustitución sin afectar al resto del sistema.

3. **Evaluar el sistema en otras microrredes para validar su transferibilidad.** Desplegar el gemelo en al menos dos o tres emplazamientos de clima distinto y reportar las métricas de predicción por sitio, para que la transferibilidad (hoy resuelta a nivel de diseño por la configuración basada en datos) quede respaldada también de forma empírica.

4. **Ampliar las capacidades predictivas.** Extender el horizonte de predicción más allá de las 24 horas, e incorporar modelos para la estimación del estado de salud (SoH) y la degradación de las baterías, así como para la detección temprana de fallos en inversores y módulos, complementando el actual diagnóstico de limpieza de paneles.

5. **Robustecer la base de datos del clasificador de imágenes.** Ampliar y diversificar el conjunto de imágenes de paneles en distintos estados, condiciones de iluminación y tipos de suciedad, con el fin de mejorar la precisión y la capacidad de generalización del modelo MobileNetV2.

6. **Completar la estrategia de pruebas.** Añadir pruebas de integración con la base de datos, pruebas de extremo a extremo sobre la interfaz web y pruebas de carga concurrente, que verifiquen el comportamiento del sistema en escenarios no cubiertos por las pruebas unitarias actuales.

7. **Fortalecer la seguridad y consolidar el despliegue institucional.** Externalizar las credenciales y las claves de firma a variables de entorno gestionadas de forma segura y revisar las políticas de autorización antes de un despliegue expuesto a redes no controladas; y formalizar el entorno de despliegue definitivo en la infraestructura de la CUJAE, documentando su diagrama y su procedimiento de puesta en marcha.

\newpage
