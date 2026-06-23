## Conclusiones parciales {.unnumbered}

Del estudio de los fundamentos y el estado del arte se concluye que:

- La operación de una microrred fotovoltaica aislada, por su generación variable, su almacenamiento finito y su falta de respaldo, supera al monitoreo reactivo y exige soportes capaces de predecir y simular.
- El gemelo digital es el paradigma que integra monitoreo, simulación y retroalimentación al sistema físico; su aplicación a microrredes aisladas, con interfaz operativa e inteligencia artificial integrada, está poco cubierta tanto en la investigación como en el mercado.
- Las soluciones afines revisadas no reúnen a la vez predicción, simulación de la autonomía, enfoque aislado e independencia del fabricante, lo que define el espacio que justifica la propuesta.
- Para predecir la generación y la demanda en horizontes de hasta veinticuatro horas con datos moderados, Random Forest ofrece el mejor equilibrio entre exactitud, robustez y costo, y se complementa con un modelo físico de irradiancia.
- El diagnóstico del estado del sistema, incluida la clasificación visual de la limpieza de los paneles, completa las capacidades del gemelo y materializa el mantenimiento basado en condición.
- El stack seleccionado (Next.js, FastAPI, MongoDB, GraphQL y las bibliotecas de aprendizaje automático) responde a criterios de madurez, idoneidad para el dominio y viabilidad para un equipo académico.

Estas conclusiones fijan los requisitos y las decisiones tecnológicas que el Capítulo 2 convierte en el diseño del sistema.
