# Recomendaciones {.unnumbered}

El sistema desarrollado cumple los objetivos planteados y queda preparado para su evolución. A partir de los resultados obtenidos y de las limitaciones reconocidas en el alcance, se formulan las siguientes recomendaciones para la continuidad del trabajo:

1. **Integrar sensores físicos en tiempo real.** Incorporar la adquisición directa de telemetría desde la microrred mediante protocolos industriales (por ejemplo, Modbus o MQTT), de modo que el gemelo digital opere sobre lecturas instrumentadas en lugar de datos sintéticos de respaldo, cerrando completamente el lazo de monitoreo entre el sistema físico y su réplica virtual.

2. **Entrenar y desplegar un modelo de consumo específico del emplazamiento.** A medida que se acumule un volumen suficiente de telemetría de demanda propia de la microrred, sustituir el algoritmo de perfiles configurables por un modelo de aprendizaje automático entrenado con esos datos y cargarlo en el servicio de producción, aprovechando el diseño modular que ya contempla esta sustitución sin afectar al resto del sistema.

3. **Ampliar las capacidades predictivas.** Extender el horizonte de predicción más allá de las 24 horas, e incorporar modelos para la estimación del estado de salud (SoH) y la degradación de las baterías, así como para la detección temprana de fallos en inversores y módulos, complementando el actual diagnóstico de limpieza de paneles.

4. **Robustecer la base de datos del clasificador de imágenes.** Ampliar y diversificar el conjunto de imágenes de paneles en distintos estados, condiciones de iluminación y tipos de suciedad, con el fin de mejorar la precisión y la capacidad de generalización del modelo MobileNetV2.

5. **Completar la estrategia de pruebas.** Añadir pruebas de integración con la base de datos, pruebas de extremo a extremo sobre la interfaz web y pruebas de carga concurrente, que verifiquen el comportamiento del sistema en escenarios no cubiertos por las pruebas unitarias actuales.

6. **Fortalecer la seguridad para producción.** Externalizar las credenciales y las claves de firma a variables de entorno gestionadas de forma segura, y revisar las políticas de autorización antes de un despliegue expuesto a redes no controladas.

7. **Consolidar el despliegue institucional.** Formalizar el entorno de despliegue definitivo en la infraestructura de la CUJAE, documentando su diagrama y su procedimiento de puesta en marcha, y evaluar la generalización del sistema a otras microrredes fotovoltaicas del país como vía de validación adicional de su transferibilidad.

\newpage
