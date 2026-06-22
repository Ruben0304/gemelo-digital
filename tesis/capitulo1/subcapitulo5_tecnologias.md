## Tecnologías de soporte: comparativa y análisis de idoneidad

Los apartados anteriores identificaron las capacidades que necesita un gemelo digital para la gestión energética y el mantenimiento predictivo de una microrred fotovoltaica aislada: monitoreo en tiempo real, predicción de producción solar, predicción de demanda, diagnóstico del estado del sistema y simulación de la autonomía del almacenamiento. Materializarlas obliga a combinar tecnologías concretas dentro de un abanico amplio de alternativas. Esta sección compara las familias candidatas, agrupadas por su rol funcional (*frontend*, *backend*, persistencia y soporte), y de ese análisis deriva cuáles encajan mejor en sistemas de este tipo.

### Tecnologías de *frontend*

El *frontend* presenta al operador el estado del gemelo, gestiona la interactividad de los controles y dialoga con los servicios de respaldo [@nextjs2024docs; @react2024docs]. Hoy conviven varios *frameworks* maduros, con perfiles distintos en lenguaje base, modelo de composición y ecosistema. La Tabla \ref{tbl:frontend} resume los analizados.

| Criterio | Next.js | Nuxt | SvelteKit | Remix |
|---|---|---|---|---|
| Lenguaje base | React / TS | Vue | Svelte | React / TS |
| Renderizado híbrido (SSR) | Sí, nativo | Sí, nativo | Sí | Sí |
| Madurez del ecosistema | Alta | Alta | Media | Media |
| Soporte documental | Amplio | Amplio | Medio | Medio |
| Curva de aprendizaje | Media | Media | Baja | Media |

: Comparación de *frameworks* de *frontend* según criterios de evaluación. {#tbl:frontend}

Las cuatro opciones cumplen los requisitos planteados [@nextjs2024docs; @react2024docs]; lo que las separa es la madurez del ecosistema, la curva de aprendizaje del equipo y la calidad de la documentación, criterios de peso en un proyecto de pregrado con plazos ajustados.

### Tecnologías de *backend*

En el *backend* recaen la lógica de negocio, los servicios de cálculo y predicción, la integración de los modelos de aprendizaje automático y el acceso a la base de datos [@fastapi2024docs; @pedregosa2011sklearn]. Aquí compiten *frameworks* de distintos lenguajes, con compromisos diferentes entre velocidad de desarrollo, desempeño y encaje con el ecosistema científico (Tabla \ref{tbl:backend}).

| Criterio | FastAPI | Django | Flask | Express |
|---|---|---|---|---|
| Lenguaje | Python | Python | Python | Node.js |
| Ecosistema científico (ML) | Alto | Alto | Alto | Bajo |
| Modelo asíncrono | Sí (ASGI) | Limitado | Limitado | Sí |
| Tipado y validación nativos | Sí (Pydantic) | Externo | Manual | Manual |
| Documentación automática | Sí (OpenAPI) | Parcial | No | No |

: Comparación de *frameworks* de *backend* según criterios de evaluación. {#tbl:backend}

La disyuntiva de fondo es Python frente a Node.js, y la decide la disponibilidad de bibliotecas científicas: el ecosistema de Python para aprendizaje automático y cálculo numérico no tiene equivalente en JavaScript [@pedregosa2011sklearn; @fastapi2024docs]. Dentro de Python, FastAPI se ha impuesto a Django y Flask por su modelo asíncrono y su tipado nativo, bien alineados con un sistema que aloja componentes de aprendizaje automático.

### Sistemas gestores de bases de datos

La persistencia guarda dos cosas de naturaleza distinta: la configuración del sistema (paneles, baterías, perfiles de consumo, programaciones) y los históricos del monitoreo continuo [@cattell2011nosql; @mongodb2024docs]. Las candidatas pertenecen a tres familias estructurales, que recoge la Tabla \ref{tbl:bd}.

| Criterio | MongoDB | PostgreSQL | InfluxDB | TimescaleDB |
|---|---|---|---|---|
| Modelo de datos | Documental | Relacional | Series temp. | Híbrido |
| Esquema flexible | Sí | Limitado | No | Limitado |
| Idoneidad en series temporales | Media | Media | Alta | Alta |
| Transaccionalidad | Básica | Estricta (ACID) | Limitada | Estricta |
| Complejidad operativa | Baja | Media | Media | Media |

: Comparación de gestores de base de datos según criterios de evaluación. {#tbl:bd}

Cuál conviene depende del perfil dominante de los datos. Si la carga combina lecturas temporales de frecuencia moderada con esquemas que evolucionan, y no exige transaccionalidad estricta entre varios agregados, el modelo documental ofrece el mejor equilibrio entre flexibilidad y desempeño [@carvalho2023nosql; @stonebraker2010sqlnosql]. Las bases de series temporales rinden cuando el volumen de eventos por unidad de tiempo es alto, algo que solo aparece con instrumentación densa y prolongada.

### Otras tecnologías de soporte

Más allá del trío *frontend*/*backend*/persistencia, el sistema necesita herramientas para la visualización web, el aprendizaje automático y la obtención de datos meteorológicos. La Tabla \ref{tbl:otras} las agrupa por categoría.

| Categoría | Alternativas representativas | Criterio dominante |
|---|---|---|
| Visualización web | D3.js (imperativa de bajo nivel), **Recharts** (declarativa sobre React), Chart.js, Plotly | Integración con el framework de componentes y velocidad de desarrollo [@bostock2011d3; @recharts2024docs] |
| ML tabular | **scikit-learn**, XGBoost, LightGBM | Madurez del ecosistema y algoritmos clásicos (Random Forest, Gradient Boosting) [@pedregosa2011sklearn; @breiman2001randomforests; @chen2016xgboost] |
| ML profundo para visión | **TensorFlow/Keras**, PyTorch, JAX | *Transfer learning* sobre modelos preentrenados y herramientas de despliegue [@sandler2018mobilenetv2; @pan2010transfer] |
| CNN ligera para visión | **MobileNetV2**, ResNet, EfficientNet, VGG | Equilibrio entre exactitud y coste de inferencia sobre hardware estándar [@sandler2018mobilenetv2] |
| Física solar | **pvlib**, SolarPy | Posición solar, radiación de cielo despejado e irradiancia efectiva a partir de coordenadas y fecha [@pvlib2024docs] |
| Datos meteorológicos | **Open-Meteo**, OpenWeather, NASA POWER, AccuWeather | Coste recurrente, granularidad temporal y disponibilidad de la irradiancia [@openmeteo2024] |

: Otras tecnologías de soporte. {#tbl:otras}

Aquí pesa el equilibrio entre la madurez de la herramienta y su encaje con el resto del stack [@recharts2024docs; @sandler2018mobilenetv2]. Las bibliotecas declarativas y las arquitecturas ligeras suelen ganar cuando la prioridad es acortar el tiempo de desarrollo sin sacrificar calidad, algo habitual en el ámbito académico.

### Tecnologías más adecuadas para el gemelo digital

A partir del análisis anterior, la Tabla \ref{tbl:tecnologias-adecuadas} reúne la opción más adecuada en cada categoría, y los párrafos que siguen explican por qué.

| Categoría | Tecnología más adecuada |
|---|---|
| *Frontend* | Next.js sobre React con TypeScript |
| *Backend* | FastAPI sobre Python |
| Base de datos | MongoDB |
| Comunicación | GraphQL + REST (híbrida) |
| Visualización | Recharts |
| Predicción solar | scikit-learn con Random Forest |
| Características físicas | pvlib |
| Detección visual | TensorFlow/Keras con MobileNetV2 |
| Fuente meteorológica | Open-Meteo |

: Tecnologías más adecuadas por categoría. {#tbl:tecnologias-adecuadas}

Para la capa de presentación, Next.js sobre React con TypeScript reúne tres ventajas que encajan con un panel en tiempo real [@nextjs2024docs; @react2024docs; @typescript2024docs]: el renderizado híbrido nativo, que junta una primera carga rápida con interactividad sostenida; la madurez del ecosistema React, con abundantes bibliotecas de componentes y documentación; y el tipado de TypeScript, superconjunto tipado del estándar ECMAScript [@ecmascript2024], que disciplina los datos que viajan entre los servicios y los componentes, algo valioso con estructuras complejas como las configuraciones de paneles o las series de predicción. Sobre esa base, la visualización se resuelve con Recharts, declarativa y nativa de React, que cubre la complejidad gráfica habitual de un tablero sin descender al nivel primitivo de bibliotecas imperativas como D3.js [@recharts2024docs; @bostock2011d3].

En el servidor, FastAPI sobre Python es la opción más pertinente [@fastapi2024docs; @pedregosa2011sklearn]: aloja los modelos en el mismo proceso que la lógica de dominio, su modelo asíncrono sostiene las consultas concurrentes a la API del clima y a la base de datos, y su tipado con Pydantic más la documentación OpenAPI bajan la fricción de desarrollo. La persistencia recae en MongoDB, que se ajusta al perfil de los datos [@mongodb2024docs; @carvalho2023nosql]: las configuraciones del sitio cambian a lo largo del proyecto y agradecen la flexibilidad documental frente a la rigidez del modelo relacional [@codd1970relational], y el volumen de lecturas históricas no llega a la magnitud que justificaría una base de series temporales dedicada.

La comunicación entre cliente y servidor se resuelve mejor con una arquitectura híbrida REST + GraphQL que con cualquiera de los dos estilos por separado [@fielding2000rest; @elghazal2025restgraphql; @lawi2021graphqlrest]. GraphQL es la interfaz primaria de datos: su esquema tipado trae en una sola petición datos solares, meteorológicos, predicciones y estado de baterías, y evita así el exceso o el defecto de información de las consultas compuestas. REST queda para la transferencia de ficheros, donde el modelo basado en recursos resulta más natural.

La predicción de la generación solar se apoya en scikit-learn con Random Forest, escogido por la evidencia comparativa del epígrafe 1.4 (competitivo en horizontes de hasta veinticuatro horas, con menor costo que alternativas más complejas) y por su integración inmediata con el ecosistema científico, que facilita reproducir los resultados [@pedregosa2011sklearn; @breiman2001randomforests]. Ese modelo se nutre de la ingeniería de características de pvlib, que a partir de coordenadas y fecha calcula la posición del sol, la radiación de cielo despejado y el índice de claridad [@pvlib2024docs]; así se concreta la estrategia híbrida físico-estadística del epígrafe 1.4, donde pvlib aporta el componente físico y Random Forest aprende las relaciones no lineales que quedan entre el clima y la producción. Para el diagnóstico visual del estado de los paneles, MobileNetV2 sobre TensorFlow/Keras con *transfer learning* da el mejor compromiso entre exactitud y coste de inferencia [@sandler2018mobilenetv2; @pan2010transfer]: su arquitectura ligera corre en hardware estándar sin GPU dedicada, y el aprendizaje por transferencia desde ImageNet recorta los datos y el tiempo de entrenamiento.

Como fuente meteorológica, Open-Meteo es la más conveniente [@openmeteo2024]: su acceso es libre y sin autenticación, su granularidad horaria a siete días basta para los modelos previstos y ofrece de forma nativa la irradiancia global horizontal, directamente correlacionada con la producción. Ninguna fuente es óptima en todas partes (su calidad depende de la densidad de observaciones de cada región), por lo que la capa que obtiene estos datos se diseñó sin acoplarse a una sola API [@leholo2026slrsolar]. El conjunto que resume la Tabla \ref{tbl:tecnologias-adecuadas} responde a un equilibrio entre madurez, accesibilidad para un equipo académico y capacidad operativa real, y es el punto de partida del diseño que aborda el Capítulo 2 [@nextjs2024docs; @said2026aidt].
