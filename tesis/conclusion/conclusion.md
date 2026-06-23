# Conclusiones {.unnumbered}

El trabajo desarrolló un gemelo digital web para microrredes fotovoltaicas aisladas, con la microrred de la CUJAE como caso de estudio. De su realización se concluye que:

1. El estudio del estado del arte mostró que ni las plataformas comerciales ni los trabajos académicos revisados reúnen a la vez predicción, simulación de la autonomía, enfoque en la operación aislada e independencia del fabricante; esa brecha justificó y orientó la propuesta.

2. Una arquitectura de monolito modular cliente–servidor, con una única API GraphQL y toda la configuración del emplazamiento en datos y no en el código, basta para sostener el gemelo digital sin la complejidad de un esquema de microservicios, e integra de forma coherente los cuatro modelos de monitoreo, predicción y simulación.

3. El modelo de generación *Havana v1* (Random Forest), evaluado con separación cronológica estricta, alcanzó un coeficiente de determinación global de 0,8989 y un error normalizado diurno del 11,4 % de la capacidad nominal, con una jerarquía de variables coherente con la física del fenómeno y mejor desempeño que las líneas base de referencia.

4. El clasificador de limpieza de paneles (MobileNetV2) alcanzó una precisión del 84,21 % y un área bajo la curva ROC de 0,8373, con el umbral de decisión calibrado para priorizar la fiabilidad de las alertas.

5. La verificación funcional de las funciones principales resultó satisfactoria, respaldada por 819 pruebas unitarias automatizadas, y la operación configurada para la microrred de la CUJAE mostró que el diseño se sostiene en condiciones de uso y que su despliegue en otra microrred se reduce a actualizar la configuración.

6. Dentro de ese alcance, los resultados respaldan la hipótesis de la investigación: el gemelo digital ofrece un apoyo útil y suficientemente preciso para la operación y el mantenimiento de una microrred fotovoltaica aislada. La principal limitación fue no contrastar las predicciones contra mediciones propias de la microrred, por no haberse recopilado aún ese histórico de operación, lo que se recoge como la primera de las recomendaciones.

\newpage
