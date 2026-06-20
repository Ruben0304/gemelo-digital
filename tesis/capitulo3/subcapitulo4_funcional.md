## Pruebas funcionales

El comportamiento observable del sistema se comprobó mediante casos de prueba de caja negra sobre sus funciones principales, contrastando para cada uno el resultado esperado con el obtenido. Las Tablas \ref{tbl:cp01} a \ref{tbl:cp07} recogen los casos de las funciones de mayor peso; el resto se verificó con la misma plantilla.

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-01 — Consultar la predicción de generación a 24 h |
| **Caso de uso** | CU-03 |
| **Precondiciones** | Usuario autenticado, paneles configurados y datos meteorológicos disponibles. |
| **Datos de entrada** | Rango de 24 horas para la ubicación de la CUJAE, con pronóstico de día soleado. |
| **Resultado esperado** | Curva horaria con producción nula de noche, ascenso desde el amanecer, pico al mediodía y descenso vespertino, escalada a la capacidad instalada. |
| **Resultado obtenido** | Curva con el perfil esperado y pico cercano al mediodía solar. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-01. {#tbl:cp01}

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-02 — Clasificar el estado de limpieza de un panel |
| **Caso de uso** | CU-05 |
| **Precondiciones** | Usuario autenticado y modelo de clasificación cargado. |
| **Datos de entrada** | Imagen de un panel con polvo, de 224×224 píxeles. |
| **Resultado esperado** | Etiqueta «sucio» con su medida de confianza y registro del resultado. |
| **Resultado obtenido** | Etiqueta «sucio» con confianza asociada; resultado registrado en el histórico. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-02. {#tbl:cp02}

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-03 — Estimar la autonomía de la batería y emitir alerta |
| **Caso de uso** | CU-06 |
| **Precondiciones** | Baterías configuradas y pronósticos de generación y consumo disponibles. |
| **Datos de entrada** | Batería al 100 %, escenario nocturno sin generación con consumo previsto. |
| **Resultado esperado** | Tiempo estimado hasta el SoC mínimo y alerta de advertencia o crítica al cruzar los umbrales del 40 % y el 20 %. |
| **Resultado obtenido** | Tiempo de autonomía calculado y alertas emitidas en los umbrales. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-03. {#tbl:cp03}

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-04 — Iniciar sesión con control de rol |
| **Caso de uso** | CU-01 |
| **Precondiciones** | Usuario registrado en el sistema. |
| **Datos de entrada** | Credenciales válidas de operador y, en una segunda corrida, credenciales inválidas. |
| **Resultado esperado** | Acceso con el rol correspondiente para credenciales válidas; rechazo para credenciales inválidas. |
| **Resultado obtenido** | Acceso concedido con rol operador; acceso denegado ante credenciales inválidas. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-04. {#tbl:cp04}

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-05 — Configurar el perfil de sombreado de la instalación |
| **Caso de uso** | Gestionar sistema energético instalado |
| **Precondiciones** | Usuario administrador autenticado y ubicación configurada. |
| **Datos de entrada** | Para cada hora solar, el porcentaje de superficie del arreglo en sombra. |
| **Resultado esperado** | El perfil se guarda y el sistema corrige las estimaciones de producción según el sombreado por hora. |
| **Resultado obtenido** | Perfil guardado; la producción estimada refleja la atenuación configurada. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-05. {#tbl:cp05}

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-06 — Cargar mediciones de consumo de un equipo |
| **Caso de uso** | Gestionar sistema energético instalado |
| **Precondiciones** | Usuario administrador autenticado y equipo registrado. |
| **Datos de entrada** | Fichero de un analizador de potencia (formato Hioki PW3360) con fecha, hora y potencia activa. |
| **Resultado esperado** | El sistema procesa el fichero y construye un perfil de 168 posiciones (día-hora) con el consumo medio del equipo. |
| **Resultado obtenido** | Perfil de 168 posiciones generado y asociado al equipo. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-06. {#tbl:cp06}

| Campo | Descripción |
|:---|:---|
| **Caso de prueba** | CP-07 — Registrar un nuevo panel en el inventario |
| **Caso de uso** | Gestionar equipos instalados |
| **Precondiciones** | Usuario administrador autenticado. |
| **Datos de entrada** | Datos de un arreglo (fabricante, potencia nominal, cantidad, inclinación y orientación). |
| **Resultado esperado** | El panel queda registrado y la capacidad instalada se actualiza para las predicciones. |
| **Resultado obtenido** | Panel registrado; la capacidad total refleja el nuevo arreglo. |
| **Veredicto** | Satisfactorio |

: Caso de prueba CP-07. {#tbl:cp07}

Todos los casos arrojaron un veredicto satisfactorio. Como complemento, la lógica interna del sistema se cubre con 776 pruebas unitarias automatizadas (678 en el backend con pytest y 98 en el frontend con Vitest), que verifican las funciones de cálculo energético, la ingeniería de características del modelo solar, la inferencia de *Havana v1*, la simulación de batería, la autenticación y la autorización, la integración con el servicio de clima y las operaciones CRUD sobre los activos, entre otras. Quedan fuera de este alcance, como vías de continuidad, las pruebas de carga concurrente y las de extremo a extremo sobre la interfaz web.
