## Pruebas funcionales

El comportamiento observable del sistema se comprobó mediante pruebas funcionales de caja negra, en las que cada función se ejercita desde la perspectiva del usuario, comparando su salida con un resultado esperado derivado de un requisito, sin examinar la implementación interna. La validación combinó dos planos: una ejecución automatizada de la lógica de negocio y los cálculos, y una comprobación manual de los aspectos de interfaz que solo son observables en la capa visual.

### Metodología

Las pruebas de caja negra conciben el sistema como una caja opaca cuyo comportamiento se evalúa solo a través de sus entradas y salidas [@pytest2024docs]. Un principio rector es que el objetivo de una prueba no es demostrar que el software funciona, sino revelar defectos; de ahí que esta validación no busque afirmar que el sistema es perfecto, sino documentar de forma transparente lo verificado y declarar las limitaciones residuales.

El diseño de los casos se apoya en técnicas reconocidas de derivación de pruebas de caja negra, que se resumen en la Tabla \ref{tbl:tecnicas}.

| Técnica | Aplicación en el gemelo digital |
|---|---|
| Partición de equivalencia | Agrupar las entradas en clases tratadas de igual modo y probar un representante de cada una (por ejemplo, credenciales válidas e inválidas, o ficheros de medición con formato correcto e incorrecto). |
| Análisis de valores límite | Probar las fronteras de las clases, donde se concentran los defectos (por ejemplo, el estado de carga justo en los umbrales del 20 % y del 40 %). |
| Tabla de decisión | Modelar reglas con varias condiciones combinadas y su resultado esperado (por ejemplo, la severidad de las alertas según el nivel de batería y el déficit previsto). |
| Basada en casos de uso | Derivar casos que recorren los flujos completos de los casos de uso (por ejemplo, consultar la predicción de generación o clasificar un panel). |

: Técnicas de diseño de pruebas de caja negra aplicadas. {#tbl:tecnicas}

Las pruebas se ejecutaron sobre un despliegue del sistema en un entorno controlado, con una base de datos de prueba independiente de la de operación, que puede reiniciarse a un estado base conocido entre ejecuciones mediante *mongomock* en el backend. Como juegos de datos se prepararon paneles y baterías de configuración conocida, perfiles de consumo, lecturas históricas e imágenes de paneles limpios y sucios, que cubren las precondiciones de los casos.

La ejecución automatizada se realizó con **pytest** en el backend y **Vitest** en el frontend [@pytest2024docs; @vitest2024docs], que ejercitan la lógica de negocio y los cálculos de forma reproducible; la comprobación manual sobre la interfaz complementó la validación de los aspectos visuales. La evaluación se apoya en tres métricas: la *tasa de aprobación* (proporción de casos aprobados sobre los ejecutados), la *cobertura de requisitos* (proporción de requisitos funcionales ejercitados por al menos un caso) y la *severidad* de los defectos, en una escala de cuatro niveles —crítica, alta, media y baja— según su impacto sobre el sistema. Un caso se considera aprobado cuando el comportamiento observado coincide con el esperado, y la cobertura se controla mediante una matriz de trazabilidad que vincula cada caso con los requisitos que ejercita.

### Diseño y ejecución de los casos de prueba

Los casos se derivan de los requisitos funcionales del Capítulo 2 y se organizan por función. La Tabla \ref{tbl:catalogo} presenta el catálogo de los casos principales, con su identificador, la función o caso de uso que ejercitan, los requisitos asociados y la técnica de diseño aplicada.

| ID | Función / caso de uso | RF | Técnica |
|---|---|---|---|
| CP-01 | Consultar la predicción de generación | RF-02, RF-04 | Basada en casos de uso |
| CP-02 | Clasificar el estado de limpieza de un panel | RF-08, RF-09 | Basada en casos de uso |
| CP-03 | Estimar la autonomía y emitir alertas | RF-06, RF-07 | Tabla de decisión y valores límite |
| CP-04 | Iniciar sesión con control de rol | RF-13, RF-14 | Partición de equivalencia |
| CP-05 | Configurar el perfil de sombreado | RF-03, RF-12 | Basada en casos de uso |
| CP-06 | Cargar mediciones de consumo (Hioki) | RF-05, RF-12 | Partición de equivalencia |
| CP-07 | Registrar un panel en el inventario | RF-01, RF-12 | Basada en casos de uso |

: Catálogo de casos de prueba funcionales. {#tbl:catalogo}

A continuación se detalla, a modo de ejemplo, el caso CP-03, que ilustra el diseño combinando una tabla de decisión y el análisis de valores límite.

La emisión de alertas combina varias condiciones, por lo que se modeló mediante una tabla de decisión (Tabla \ref{tbl:decision-alertas}): el nivel de batería previsto y el déficit entre generación y consumo determinan la severidad de la alerta.

| Nivel de batería previsto | Déficit superior al 50 % del consumo | Alerta emitida |
|---|---|---|
| Menor que 20 % | Cualquiera | Crítica |
| Entre 20 % y 40 % | Cualquiera | Advertencia |
| Mayor o igual que 40 % | Sí | Advertencia |
| Mayor o igual que 40 % | No | Ninguna |

: CP-03 — tabla de decisión de las alertas operativas. {#tbl:decision-alertas}

Sobre esas reglas, el análisis de valores límite prueba los estados de carga en las fronteras del 20 % y del 40 %, donde es más probable que se concentren los errores (Tabla \ref{tbl:limites-soc}).

| Estado de carga previsto | Clase | Alerta esperada |
|---|---|---|
| 19 % | Por debajo del umbral crítico | Crítica |
| 20 % | Frontera crítico–advertencia | Crítica |
| 21 % | Zona de advertencia | Advertencia |
| 40 % | Frontera advertencia–normal | Advertencia |
| 41 % | Zona normal | Ninguna |

: CP-03 — valores límite del estado de carga. {#tbl:limites-soc}

La Tabla \ref{tbl:ficha-cp03} recoge la ficha de especificación del caso, según la plantilla empleada para todos los casos del catálogo.

| Aspecto | Descripción |
|---|---|
| **Objetivo** | Verificar que la estimación de autonomía y la severidad de las alertas responden a los umbrales del estado de carga y al déficit previsto. |
| **Precondición** | Baterías configuradas y pronósticos de generación y consumo disponibles. |
| **Datos de entrada** | Batería al 100 %, escenario nocturno sin generación con un consumo previsto. |
| **Pasos** | 1) Solicitar la estimación de autonomía. 2) Recorrer el horizonte hasta cruzar los umbrales del 40 % y del 20 %. |
| **Resultado esperado** | Tiempo hasta el estado de carga mínimo mayor que cero; alerta de advertencia al cruzar el 40 % y crítica al cruzar el 20 %, conforme a la Tabla \ref{tbl:decision-alertas}. |
| **Resultado obtenido** | Tiempo de autonomía calculado; alertas de advertencia y crítica emitidas en los umbrales previstos. |
| **Veredicto** | Satisfactorio. |

: CP-03 — especificación del caso de prueba. {#tbl:ficha-cp03}

### Resultados y cobertura

Todos los casos del catálogo arrojaron un veredicto satisfactorio: el comportamiento observado coincidió con el esperado en cada uno, por lo que la tasa de aprobación fue del 100 %. La ejecución de la lógica de negocio se respaldó con **776 pruebas unitarias automatizadas** (678 en el backend con pytest y 98 en el frontend con Vitest), que verifican las funciones de cálculo energético, la ingeniería de características del modelo solar, la inferencia de *Havana v1*, la simulación de batería, la autenticación y la autorización, la integración con el servicio de clima y las operaciones CRUD sobre los activos, entre otras; su distribución por archivo se recoge en el Anexo B.

La cobertura se evaluó mediante la matriz de trazabilidad entre los casos de prueba y los requisitos funcionales: cada uno de los catorce requisitos definidos en el Capítulo 2 queda ejercitado por al menos un caso. No se detectaron defectos bloqueantes en las funciones cubiertas. Quedan fuera de este alcance, como vías de continuidad, las pruebas de carga concurrente y las de extremo a extremo sobre la interfaz web.
