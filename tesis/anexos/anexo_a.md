# Anexos {.unnumbered}

## Anexo A — Especificación de los casos de uso restantes {.unnumbered}

El Capítulo 2 detalla, mediante la plantilla de especificación, los tres casos de uso principales del sistema (CU-03, CU-05 y CU-06). Por completitud, se recogen aquí los seis casos de uso restantes del diagrama de la Figura \ref{fig:cus}, descritos con la misma plantilla.

| Campo | Descripción |
|:---|:---|
| **Caso de uso** | Iniciar sesión |
| **Actores** | Operador, Administrador, Sistema LDAP (servicio externo) |
| **Descripción** | El usuario introduce sus credenciales. El sistema verifica la identidad mediante un token JWT (HS256), asigna el rol correspondiente y habilita las funcionalidades asociadas. |
| **Requisitos funcionales** | RF-13, RF-14 |
| **Precondiciones** | El usuario está registrado o dispone de un código de invitación válido, y el servicio de autenticación está disponible. |
| **Postcondiciones** | El usuario queda autenticado con su rol y obtiene un token de sesión. |

: Caso de uso CU-01 — Iniciar sesión.

| Campo | Descripción |
|:---|:---|
| **Caso de uso** | Consultar condiciones meteorológicas actuales |
| **Actores** | Operador, API Clima (servicio externo) |
| **Descripción** | El operador solicita las condiciones y el pronóstico para la ubicación de la microrred. El sistema consulta la API de clima y las presenta en el tablero. |
| **Requisitos funcionales** | RF-03, RF-10 |
| **Precondiciones** | El usuario está autenticado y el servicio meteorológico, o su respaldo, está disponible. |
| **Postcondiciones** | Las condiciones y el pronóstico quedan visibles y disponibles para otros módulos. |

: Caso de uso CU-02 — Consultar condiciones meteorológicas actuales.

| Campo | Descripción |
|:---|:---|
| **Caso de uso** | Consultar datos históricos |
| **Actores** | Operador |
| **Descripción** | El operador selecciona un intervalo de fechas y las variables de interés. El sistema recupera las series temporales almacenadas y las presenta en gráficos y tablas. |
| **Requisitos funcionales** | RF-02, RF-10, RF-11 |
| **Precondiciones** | El usuario está autenticado y existe información histórica registrada. |
| **Postcondiciones** | Las series solicitadas se muestran en la interfaz. |

: Caso de uso CU-04 — Consultar datos históricos.

| Campo | Descripción |
|:---|:---|
| **Caso de uso** | Gestionar equipos instalados |
| **Actores** | Administrador |
| **Descripción** | El administrador registra, modifica o elimina los equipos de la microrred: paneles, baterías, inversores y cargas. |
| **Requisitos funcionales** | RF-01, RF-12, RF-14 |
| **Precondiciones** | El usuario está autenticado como administrador y la base de datos está disponible. |
| **Postcondiciones** | El inventario de activos queda actualizado y disponible para el resto de los módulos. |

: Caso de uso CU-07 — Gestionar equipos instalados.

| Campo | Descripción |
|:---|:---|
| **Caso de uso** | Gestionar usuarios |
| **Actores** | Administrador |
| **Descripción** | El administrador genera códigos de invitación asociados a un rol y administra las cuentas del sistema. |
| **Requisitos funcionales** | RF-13, RF-14 |
| **Precondiciones** | El usuario está autenticado como administrador. |
| **Postcondiciones** | Las cuentas y los códigos de invitación quedan creados o actualizados, con sus roles. |

: Caso de uso CU-08 — Gestionar usuarios.

| Campo | Descripción |
|:---|:---|
| **Caso de uso** | Gestionar sistema energético instalado |
| **Actores** | Administrador |
| **Descripción** | El administrador configura los parámetros globales de la instalación: la ubicación geográfica, las fuentes de clima, el perfil de consumo y el perfil de sombreado. |
| **Requisitos funcionales** | RF-03, RF-12, RF-14 |
| **Precondiciones** | El usuario está autenticado como administrador. |
| **Postcondiciones** | La configuración queda actualizada, lo que permite adaptar el sistema a distintas microrredes sin modificar el código. |

: Caso de uso CU-09 — Gestionar sistema energético instalado.

## Anexo B — Distribución de las pruebas unitarias automatizadas {.unnumbered}

Las 776 pruebas unitarias mencionadas en el Capítulo 3 se distribuyen por dominio funcional como se indica a continuación. El backend (Python, pytest) reúne 678 pruebas y el frontend (TypeScript, Vitest) 98.

| Archivo (backend) | Pruebas | Funciones y servicios cubiertos |
|:---|:--:|:---|
| `test_graphql_schema.py` | 123 | Esquema y *resolvers* GraphQL (consultas y mutaciones) |
| `test_weather_source_service.py` | 61 | Fuentes de clima y adaptador (patrón Adapter) |
| `test_weather_http.py` | 52 | Cliente HTTP del servicio meteorológico y respaldo |
| `test_consumption_profile_service.py` | 39 | Perfiles de consumo configurables |
| `test_prediction_service.py` | 37 | Producción horaria y proyección de batería |
| `test_user_service_integration.py` | 34 | Servicio de usuarios (integración) |
| `test_inverter_service.py` | 34 | Gestión de inversores |
| `test_user_service.py` | 31 | Usuarios: normalización, hashing *scrypt* y roles |
| `test_crud_services.py` | 31 | CRUD de paneles, baterías y cargas (*mongomock*) |
| `test_appliance_measurement_service.py` | 31 | Mediciones de consumo por equipo |
| `test_lectura_service.py` | 28 | Lecturas históricas (telemetría) |
| `test_session_service.py` | 24 | Sesiones de usuario |
| `test_invitation_service.py` | 24 | Códigos de invitación |
| `test_shadow_profile_service.py` | 20 | Perfil de sombreado |
| `test_location_config_service.py` | 20 | Configuración de ubicación |
| `test_auth_guards.py` | 19 | Guardas de autorización JWT y restricción por rol |
| `test_analytics.py` | 18 | Métricas energéticas, balance y flujos |
| `test_battery_discharge.py` | 17 | Simulación de descarga y autonomía de la batería |
| `test_ml_production.py` | 10 | Modelo de producción *Havana v1* |
| `test_panel_classifier.py` | 9 | Clasificador de limpieza de paneles |
| `test_ml_consumption.py` | 9 | Modelo de consumo |
| `test_solar_query.py` | 7 | Consulta solar agregada |
| **Total** | **678** | |

: Distribución de las pruebas del backend.

| Archivo (frontend) | Pruebas | Funciones cubiertas |
|:---|:--:|:---|
| `calculations.test.ts` | 40 | Métricas, flujo de energía, eficiencia, *Performance Ratio* [@iec61724], estrategia de batería |
| `permissions.test.ts` | 23 | Permisos y control de acceso por rol |
| `shadowCalc.test.ts` | 18 | Cálculo del perfil de sombreado |
| `predictions.test.ts` | 17 | Predicciones horarias y alertas por severidad |
| **Total** | **98** | |

: Distribución de las pruebas del frontend.

\newpage
