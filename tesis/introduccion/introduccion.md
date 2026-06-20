\clearpage
\pagenumbering{arabic}
\setcounter{page}{1}

# Introducción {.unnumbered}

La generación de electricidad ha ido dejando atrás el modelo centralizado para apoyarse cada vez más en fuentes renovables distribuidas, y entre ellas la energía solar fotovoltaica ocupa un lugar destacado por su madurez tecnológica y su bajo costo [@kumar2020microgrid]. En ese marco han ganado protagonismo las microrredes: sistemas eléctricos de pequeña o mediana escala que reúnen generación, almacenamiento y consumo dentro de un perímetro definido. Cuando operan de forma aislada, sin el respaldo de una red mayor, el equilibrio entre lo que se genera y lo que se consume debe resolverse con los recursos propios del sistema, lo que vuelve crítico anticipar la producción, la demanda y el estado del almacenamiento [@wang2023isolatedmg; @dhimish2025reliability].

A escala internacional ya existen herramientas para acompañar la operación de estas instalaciones. Los principales fabricantes ofrecen plataformas de monitoreo en la nube asociadas a sus equipos, como Enphase Enlighten, Huawei FusionSolar o el portal de SolarEdge [@enphase2024enlighten; @huawei2024fusionsolar; @solaredge2024monitoring], que muestran la generación y el estado de los componentes en tiempo real. En el plano académico, el concepto de gemelo digital (una réplica virtual que se alimenta de los datos del sistema real para analizarlo y anticipar su comportamiento) se ha aplicado con buenos resultados a instalaciones fotovoltaicas [@casillo2025dtpv; @tao2025dtrev]. Ahora bien, las plataformas comerciales son propietarias, están atadas al hardware del fabricante y se limitan a mostrar lo que ocurre, sin predecir ni permitir simular escenarios; las propuestas académicas, por su parte, rara vez llegan a una herramienta abierta, transferible y ajustada a un emplazamiento concreto.

En Cuba, la inestabilidad del suministro eléctrico y la apuesta nacional por las fuentes renovables otorgan especial valor a estas instalaciones. La CUJAE cuenta con una microrred fotovoltaica que es, al mismo tiempo, infraestructura de generación y laboratorio para la docencia y la investigación. Su seguimiento, sin embargo, se apoya en registros básicos y en la observación directa: no se dispone de una herramienta que prediga la generación y el consumo a partir de los datos locales, que estime la autonomía de las baterías o que detecte de forma temprana la pérdida de rendimiento de los paneles. Las soluciones comerciales resultan costosas, dependen del fabricante y no se ajustan a las condiciones del lugar, así que la brecha entre lo que la instalación necesita y lo que las herramientas disponibles ofrecen sigue abierta.

De esa carencia surge el **problema científico** que guía la investigación: ¿cómo monitorear, predecir y apoyar la toma de decisiones en tiempo real sobre la operación y el mantenimiento de una microrred fotovoltaica aislada mediante un sistema informático adaptado a las condiciones de un emplazamiento concreto?

El **objeto de estudio** es la gestión y el mantenimiento de las microrredes fotovoltaicas aisladas. El **campo de acción** lo constituyen los gemelos digitales y los modelos de inteligencia artificial aplicados al monitoreo, la predicción y el apoyo a la decisión en ese tipo de instalaciones.

Se plantea como **hipótesis** que un gemelo digital web que integre modelos de aprendizaje automático entrenados con datos locales y una simulación del almacenamiento permitirá monitorear, predecir y apoyar la toma de decisiones de una microrred fotovoltaica aislada con la precisión suficiente para asistir su operación y su mantenimiento.

Para comprobarla se define como **objetivo general** desarrollar un gemelo digital web, con técnicas de inteligencia artificial, para la gestión energética y el mantenimiento predictivo de microrredes fotovoltaicas aisladas, tomando como caso de estudio la microrred de la CUJAE. Este objetivo se concreta en tres objetivos específicos, cada uno vinculado a uno de los capítulos del trabajo, con sus tareas y responsables.

1. Caracterizar el estado del arte y los fundamentos del gemelo digital con inteligencia artificial para la gestión energética y el mantenimiento predictivo de microrredes fotovoltaicas aisladas.

    - Analizar el contexto energético cubano y el papel de las microrredes fotovoltaicas aisladas. *(Ambos.)*
    - Estudiar los conceptos, tipos y componentes de los gemelos digitales aplicados a sistemas energéticos. *(Ambos.)*
    - Revisar las técnicas de inteligencia artificial para el pronóstico de generación y consumo y el diagnóstico del estado de los paneles. *(Ambos.)*
    - Comparar las soluciones afines existentes, académicas y comerciales. *(Ambos.)*
    - Seleccionar las tecnologías de software adecuadas para el sistema. *(Fabián, backend y modelos; Rubén, frontend y visualización.)*

2. Desarrollar la solución de software del gemelo digital para una microrred fotovoltaica aislada, con su arquitectura, su modelo de datos y sus interfaces.

    - Definir los requisitos funcionales y no funcionales y los casos de uso del sistema. *(Ambos.)*
    - Diseñar la arquitectura de software, con la separación entre el backend y el frontend. *(Fabián, vista backend; Rubén, vista frontend.)*
    - Modelar la base de datos documental de la microrred. *(Fabián.)*
    - Implementar el backend con los servicios de telemetría, predicción, simulación de autonomía y gestión de activos. *(Fabián.)*
    - Entrenar los modelos de inteligencia artificial de predicción y de clasificación del estado de los paneles. *(Fabián.)*
    - Implementar la interfaz web con los tableros de producción, consumo, baterías, clima, predicciones y alertas. *(Rubén.)*
    - Integrar el frontend con el backend a través de la API GraphQL. *(Rubén.)*
    - Documentar la arquitectura y el despliegue del sistema. *(Ambos.)*

3. Validar el gemelo digital mediante un análisis experimental sobre la microrred de la CUJAE.

    - Ejecutar los casos de prueba funcional de caja negra sobre las funciones principales del sistema. *(Ambos; Fabián, backend; Rubén, frontend.)*
    - Evaluar el desempeño de los modelos de predicción y de clasificación con métricas estándar. *(Fabián.)*
    - Verificar la corrección del software mediante pruebas automatizadas. *(Ambos; Fabián, backend; Rubén, frontend.)*
    - Operar el sistema sobre la microrred de la CUJAE para mostrar sus capacidades de monitoreo, predicción y simulación. *(Ambos.)*
    - Valorar la utilidad del sistema para la gestión y el mantenimiento de la microrred. *(Ambos.)*

El valor práctico del trabajo es que se cuenta con un sistema que permite saber con antelación cuánta energía habrá disponible, decidir con más criterio cuándo apoyarse en las baterías y advertir cuándo conviene limpiar los paneles, sin depender de productos comerciales costosos ni de personal especializado de forma permanente. Como toda la configuración del emplazamiento se guarda en datos y no en el código, la misma herramienta puede servir a otras microrredes del país; y por estar construida con tecnologías libres, queda además como recurso docente e investigativo para la universidad.

El documento se organiza en tres capítulos:

**Capítulo 1. Fundamentos teóricos del gemelo digital para microrredes.** Describe el contexto de las microrredes fotovoltaicas aisladas y su operación, sigue la línea que va del monitoreo digital al gemelo digital, compara las soluciones afines —académicas y comerciales— y examina las técnicas de inteligencia artificial y las tecnologías de software pertinentes, justificando las que se adoptan.

**Capítulo 2. Análisis y diseño de la solución.** Presenta el gemelo digital propuesto y sus requisitos, define su arquitectura mediante sus distintas vistas y diagramas, expone los principios y patrones de diseño que ordenan el código y detalla el despliegue y la integración con servicios externos.

**Capítulo 3. Análisis experimental.** Describe el escenario experimental y los datos empleados, evalúa los modelos de inteligencia artificial frente a alternativas de referencia, comprueba el comportamiento del sistema mediante casos de prueba de caja negra y muestra su operación sobre la microrred de la CUJAE.

El trabajo cierra con las conclusiones generales, las recomendaciones para su continuidad y las referencias bibliográficas.
