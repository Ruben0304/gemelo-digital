## Evaluación de los modelos

Los modelos se evalúan sobre conjuntos de prueba separados de los de entrenamiento, con las métricas estándar de cada tarea: para la regresión (generación), el coeficiente de determinación R², el error cuadrático medio (RMSE) y el error absoluto medio (MAE); para la clasificación (limpieza), la exactitud, la precisión, la sensibilidad, el F1 y el área bajo la curva ROC [@pedregosa2011sklearn; @lodhi2023faultpv].

### Construcción y entrenamiento de los modelos

Antes de evaluarlos conviene describir cómo se construyen los cuatro modelos del gemelo, pues las condiciones de entrenamiento condicionan la lectura de sus resultados.

El modelo de generación, *Havana v1*, es un Random Forest entrenado con el dataset de La Habana. La variable objetivo es el **factor de capacidad** (un valor adimensional entre 0 y 1), de modo que el mismo modelo sirve a cualquier tamaño de instalación: en operación, la predicción se multiplica por la capacidad instalada leída de la base de datos. El modelo usa **14 características** en tres grupos: cinco climáticas directas (radiación de onda corta, nubosidad, temperatura, humedad y viento); cinco físicas derivadas con pvlib (radiación de cielo despejado, índice de claridad, elevación solar, irradiancia efectiva atenuada por nubosidad y un factor de pérdida por temperatura de −0,4 % por grado sobre los 25 °C de referencia); y cuatro temporales cíclicas (seno y coseno de la hora y del mes) [@pvlib2024docs; @almarzooqi2024hybrid]. Esta ingeniería de características se concentra en un único módulo compartido entre el entrenamiento y la inferencia, lo que elimina por construcción cualquier discrepancia entre ambos contextos (*train/serve skew*). La partición es estrictamente cronológica, con el primer 80 % del histórico para entrenamiento (42 067 muestras) y el 20 % restante para validación (10 517 muestras), de modo que el modelo predice siempre sobre fechas posteriores a las de entrenamiento [@trull2025folsom].

La predicción del consumo se resuelve en el despliegue actual con un algoritmo de perfiles horarios configurables (una curva de consumo por hora para los días lectivos y otra para los fines de semana, ajustadas por un modelo de confianza que penaliza las horas de mayor variabilidad), una estrategia de arranque en frío adecuada al volumen de datos disponible [@khan2026energyconsumption]. En paralelo se dejó preparada la integración de un Random Forest de consumo, que se activará cuando se acumule un histórico representativo de la propia microrred. La estimación de autonomía, por su parte, no es un modelo entrenado, sino una simulación horaria que reutiliza los dos anteriores y la física del almacenamiento.

El clasificador de limpieza es una red MobileNetV2 preentrenada en ImageNet sobre la que se aplica aprendizaje por transferencia: se congela el extractor de características y se entrena solo una cabeza binaria [@sandler2018mobilenetv2; @pan2010transfer]. Todos los modelos se serializan y se cargan al inicio del servicio; los notebooks de entrenamiento, versionados en Git con dependencias fijadas, reproducen exactamente las transformaciones que ejecuta el *backend* en producción, de modo que el reentrenamiento periódico resulte reproducible.

### Predicción de la generación solar

El modelo de generación *Havana v1* se evalúa sobre el conjunto de prueba (el 20 % final del histórico, 10 517 muestras), posterior a las fechas de entrenamiento; la partición cronológica estricta evita la fuga temporal y hace que el error medido sea una cota conservadora del real [@trull2025folsom]. La elección del Random Forest se apoya en una comparación frente a una regresión lineal, como línea base, y un HistGradient Boosting, evaluada solo sobre las horas de luz para no inflar el R² con las horas nocturnas de producción nula (Figura \ref{fig:comparacion-solar} y Tabla \ref{tbl:comparacion-solar}).

![Comparación de modelos de predicción solar (horas de día).](comparacion_modelos_solar.png){#fig:comparacion-solar width=85%}

| Modelo | R² (día) | nRMSE (día) | nMAE (día) |
|---|---|---|---|
| Regresión lineal (línea base) | 0,754 | 12,4 % | 8,8 % |
| **Random Forest** (seleccionado) | **0,789** | **11,4 %** | **7,5 %** |
| HistGradient Boosting | 0,785 | 11,6 % | 7,5 % |

: Comparación de modelos sobre el conjunto de prueba, horas de día. nRMSE y nMAE como porcentaje de la capacidad nominal. {#tbl:comparacion-solar}

Los tres modelos convergen a valores casi iguales. Eso apunta a que el techo de precisión lo marca la fuente de datos (la brecha entre la radiación de Open-Meteo y la producción de PVGIS), no el algoritmo. Ante esa convergencia se elige el Random Forest por el mayor R² diurno (0,789), por su robustez frente a datos ruidosos y por exigir menos ajuste [@breiman2001randomforests]. Sobre el conjunto de prueba alcanza un R² global de 0,8989, es decir, explica cerca del 90 % de la varianza; en las horas con utilidad operativa, el R² diurno es de 0,7895, el nRMSE del 11,4 % y el nMAE del 7,5 % de la capacidad nominal, valores dentro del rango que reporta la literatura para estos métodos con separación cronológica [@leholo2026slrsolar; @taha2025zafarana].

La Figura \ref{fig:importance-solar} muestra la importancia de las características: domina la irradiancia de onda corta, seguida del índice de claridad y la elevación solar. Esta jerarquía coincide con la física del fenómeno, pues la potencia es casi proporcional a la radiación, modulada por la posición del sol y la transparencia de la atmósfera; es un indicio cualitativo de validez que se suma a las métricas [@trull2025folsom].

![Importancia de las características del modelo *Havana v1*.](feature_importance_solar.png){#fig:importance-solar width=85%}

Por último, la Figura \ref{fig:perfil-diario} compara el factor de capacidad horario que predice el modelo para un día soleado y uno nublado. En ambos reproduce el patrón esperado (producción nula de noche, ascenso desde el amanecer, pico al mediodía y descenso simétrico) y modela la atenuación del día nublado. En operación, ese factor se multiplica por la capacidad instalada leída de la base de datos, de modo que el modelo se ajusta a cualquier tamaño de instalación sin reentrenarse.

![Perfil de producción diaria simulado: día soleado frente a día nublado.](perfil_produccion_diaria.png){#fig:perfil-diario width=85%}
