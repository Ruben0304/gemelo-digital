### Clasificación del estado de los paneles

El clasificador de limpieza es una red MobileNetV2 con aprendizaje por transferencia: se reutiliza el extractor de características preentrenado en ImageNet, con sus pesos congelados, y se entrena solo una cabeza binaria, de modo que únicamente 166 913 de los 2,76 millones de parámetros del modelo resultan entrenables [@sandler2018mobilenetv2; @pan2010transfer]. El entrenamiento dura seis épocas y todas las métricas se calculan sobre las 511 imágenes de validación.

La Figura \ref{fig:cnn-metrics} reúne las cinco métricas. La exactitud es del 78,67 %, la precisión del 84,21 %, la sensibilidad del 60,09 %, el F1 del 70,14 % y el AUC-ROC de 0,8373. La asimetría entre precisión y sensibilidad es deliberada: el umbral de decisión se calibró para que las alertas sean fiables (cuando el sistema avisa de un panel sucio, acierta en unos cuatro de cada cinco casos), a costa de que algunos paneles sucios pasen inadvertidos. Es un compromiso aceptable en el mantenimiento basado en condición, donde una alerta de más cuesta menos que una intervención omitida [@dhimish2025reliability; @chehri2021condition].

![Métricas del clasificador de limpieza de paneles.](cnn_metrics.png){#fig:cnn-metrics width=62%}

La matriz de confusión (Figura \ref{fig:cnn-cm}) lo confirma: de las 511 imágenes, el modelo acierta 274 limpias y 128 sucias (402 aciertos), con 24 falsos positivos y 85 falsos negativos. La curva ROC (Figura \ref{fig:cnn-roc}), situada por encima de la diagonal con un AUC de 0,8373, indica una capacidad discriminativa buena y sugiere que, ajustando el umbral, puede desplazarse el compromiso entre precisión y sensibilidad según la necesidad operativa.

![Matriz de confusión del clasificador.](confusion_matrix.png){#fig:cnn-cm width=70%}

![Curva ROC del clasificador.](roc_curve.png){#fig:cnn-roc width=70%}

La curva de aprendizaje (Figura \ref{fig:cnn-training}) muestra que el modelo converge en las dos primeras épocas, lo esperable en aprendizaje por transferencia, y se mantiene estable en validación, sin sobreajuste apreciable. Los falsos negativos corresponden a polvo leve o no uniforme y los falsos positivos a sombras o reflejos, errores coherentes con los que documenta la literatura del campo [@lodhi2023faultpv].

![Curva de aprendizaje del clasificador durante el entrenamiento.](training_history_cnn.png){#fig:cnn-training width=85%}
