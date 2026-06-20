## Tecnologías de soporte: comparativa y análisis de idoneidad

Los apartados anteriores identificaron las capacidades que requiere un gemelo digital para la gestión energética y el mantenimiento predictivo de una microrred fotovoltaica aislada: monitoreo en tiempo real, predicción de producción solar, predicción de demanda, diagnóstico del estado del sistema y simulación de la autonomía del almacenamiento. Materializarlas exige conjugar tecnologías específicas dentro de un amplio conjunto de alternativas. Esta sección compara las familias tecnológicas candidatas, agrupadas por su rol funcional (frontend, backend, persistencia y soporte) y, sobre la base del análisis, sintetiza cuáles resultan más adecuadas para sistemas de este tipo.

### Tecnologías de frontend

El componente de frontend se ocupa de la presentación del estado del gemelo digital al operador, de la interactividad de los controles y de la comunicación con los servicios de respaldo [@nextjs2024docs; @react2024docs]. En el ecosistema actual conviven varios *frameworks* maduros, con perfiles diferenciados en lenguaje base, paradigma de composición y ecosistema asociado. La Tabla \ref{tbl:frontend} sintetiza las alternativas analizadas.

| Criterio | Next.js | Nuxt | SvelteKit | Remix |
|---|---|---|---|---|
| Lenguaje base | React / TS | Vue | Svelte | React / TS |
| Renderizado híbrido (SSR) | Sí, nativo | Sí, nativo | Sí | Sí |
| Madurez del ecosistema | Alta | Alta | Media | Media |
| Soporte documental | Amplio | Amplio | Medio | Medio |
| Curva de aprendizaje | Media | Media | Baja | Media |

: Comparación de *frameworks* de frontend según criterios de evaluación. {#tbl:frontend}

Las cuatro alternativas son técnicamente viables para los requisitos planteados [@nextjs2024docs; @react2024docs]. Las diferencias dominantes residen en la madurez del ecosistema, en la curva de aprendizaje del equipo y en la calidad del soporte documental, criterios relevantes en un proyecto de pregrado con plazos acotados.

### Tecnologías de backend

El componente de backend aloja la lógica de negocio, expone los servicios de cálculo y predicción, integra los modelos de aprendizaje automático y media el acceso a la base de datos [@fastapi2024docs; @pedregosa2011sklearn]. Conviven *frameworks* basados en distintos lenguajes, con compromisos diferentes entre velocidad de desarrollo, desempeño y compatibilidad con el ecosistema científico. La Tabla \ref{tbl:backend} sintetiza las alternativas.

| Criterio | FastAPI | Django | Flask | Express |
|---|---|---|---|---|
| Lenguaje | Python | Python | Python | Node.js |
| Ecosistema científico (ML) | Alto | Alto | Alto | Bajo |
| Modelo asíncrono | Sí (ASGI) | Limitado | Limitado | Sí |
| Tipado y validación nativos | Sí (Pydantic) | Externo | Manual | Manual |
| Documentación automática | Sí (OpenAPI) | Parcial | No | No |

: Comparación de *frameworks* de backend según criterios de evaluación. {#tbl:backend}

La elección entre Python y Node.js responde sobre todo a la disponibilidad de bibliotecas científicas: el ecosistema de Python para aprendizaje automático y procesamiento numérico no tiene equivalente en JavaScript [@pedregosa2011sklearn; @fastapi2024docs]. Dentro de Python, FastAPI se ha consolidado frente a Django y Flask por su modelo asíncrono y su tipado nativo, alineados con un sistema integrado con componentes de aprendizaje automático.

### Sistemas gestores de bases de datos

El componente de persistencia almacena la configuración del sistema (paneles, baterías, perfiles de consumo, programaciones) y los históricos operativos del monitoreo continuo [@cattell2011nosql; @mongodb2024docs]. Las alternativas pertenecen a tres familias estructurales, que resume la Tabla \ref{tbl:bd}.

| Criterio | MongoDB | PostgreSQL | InfluxDB | TimescaleDB |
|---|---|---|---|---|
| Modelo de datos | Documental | Relacional | Series temp. | Híbrido |
| Esquema flexible | Sí | Limitado | No | Limitado |
| Idoneidad en series temporales | Media | Media | Alta | Alta |
| Transaccionalidad | Básica | Estricta (ACID) | Limitada | Estricta |
| Complejidad operativa | Baja | Media | Media | Media |

: Comparación de gestores de base de datos según criterios de evaluación. {#tbl:bd}

La idoneidad de cada alternativa depende del perfil dominante de los datos. Cuando la carga combina lecturas temporales de frecuencia moderada con configuraciones de esquema evolutivo y no exige transaccionalidad estricta entre múltiples agregados, el modelo documental ofrece el mejor compromiso entre flexibilidad y desempeño [@carvalho2023nosql; @stonebraker2010sqlnosql]. Las bases de series temporales aportan ventajas cuando el volumen de eventos por unidad de tiempo es elevado, escenario que solo emerge en despliegues con instrumentación densa y prolongada.

### Otras tecnologías de soporte

Al margen del trío frontend/backend/persistencia, el sistema requiere tecnologías complementarias para visualización web, aprendizaje automático y obtención de datos meteorológicos. La Tabla \ref{tbl:otras} resume las alternativas por categoría.

| Categoría | Alternativas representativas | Criterio dominante |
|---|---|---|
| Visualización web | D3.js (imperativa de bajo nivel), **Recharts** (declarativa sobre React), Chart.js, Plotly | Integración con el framework de componentes y velocidad de desarrollo [@bostock2011d3; @recharts2024docs] |
| ML tabular | **scikit-learn**, XGBoost, LightGBM | Madurez del ecosistema y algoritmos clásicos (Random Forest, Gradient Boosting) [@pedregosa2011sklearn; @breiman2001randomforests; @chen2016xgboost] |
| ML profundo para visión | **TensorFlow/Keras**, PyTorch, JAX | *Transfer learning* sobre modelos preentrenados y herramientas de despliegue [@sandler2018mobilenetv2; @pan2010transfer] |
| CNN ligera para visión | **MobileNetV2**, ResNet, EfficientNet, VGG | Equilibrio entre exactitud y coste de inferencia sobre hardware estándar [@sandler2018mobilenetv2] |
| Física solar | **pvlib**, SolarPy | Posición solar, radiación de cielo despejado e irradiancia efectiva a partir de coordenadas y fecha [@pvlib2024docs] |
| Datos meteorológicos | **Open-Meteo**, OpenWeather, NASA POWER, AccuWeather | Coste recurrente, granularidad temporal y disponibilidad de la irradiancia [@openmeteo2024] |

: Otras tecnologías de soporte. {#tbl:otras}

En estas categorías, la idoneidad se apoya en el equilibrio entre la madurez de la herramienta y su compatibilidad con el resto del stack [@recharts2024docs; @sandler2018mobilenetv2]. Las bibliotecas declarativas y las arquitecturas ligeras tienden a imponerse cuando se busca minimizar el tiempo de desarrollo sin sacrificar la calidad del resultado, situación habitual en proyectos académicos.

### Tecnologías más adecuadas para el gemelo digital

A partir del análisis precedente, la Tabla \ref{tbl:tecnologias-adecuadas} resume las tecnologías más adecuadas en cada categoría funcional, y los párrafos siguientes explican los criterios que justifican cada elección.

| Categoría | Tecnología más adecuada |
|---|---|
| Frontend | **Next.js** sobre **React** con **TypeScript** |
| Backend | **FastAPI** sobre **Python** |
| Base de datos | **MongoDB** |
| Comunicación | **GraphQL** + **REST** (híbrida) |
| Visualización | **Recharts** |
| Predicción solar | **scikit-learn** con **Random Forest** |
| Características físicas | **pvlib** |
| Detección visual | **TensorFlow/Keras** con **MobileNetV2** |
| Fuente meteorológica | **Open-Meteo** |

: Tecnologías más adecuadas por categoría. {#tbl:tecnologias-adecuadas}

En el **frontend**, Next.js sobre React con TypeScript destaca por tres razones [@nextjs2024docs; @react2024docs; @typescript2024docs]: el renderizado híbrido nativo, que combina una primera carga rápida con interactividad sostenida, propio de un panel en tiempo real; la madurez del ecosistema React, con abundantes bibliotecas de componentes y soporte documental; y la disciplina de tipado que aporta TypeScript a los datos que circulan entre la capa de servicios y la de componentes, relevante con estructuras complejas como configuraciones de paneles o series de predicciones.

En el **backend**, FastAPI sobre Python es la alternativa más pertinente [@fastapi2024docs; @pedregosa2011sklearn]: permite alojar los modelos en el mismo proceso que la lógica de dominio, su modelo asíncrono sostiene las consultas concurrentes a la API meteorológica y a la base de datos, y su tipado nativo con Pydantic y la documentación OpenAPI reducen la fricción de desarrollo.

En la **persistencia**, MongoDB se ajusta al perfil de los datos [@mongodb2024docs; @carvalho2023nosql]: las configuraciones del emplazamiento evolucionan a lo largo del proyecto, lo que favorece la flexibilidad documental sobre la rigidez relacional, y el volumen de lecturas históricas no alcanza la magnitud que justificaría la complejidad de una base de series temporales dedicada.

En la **comunicación**, una arquitectura híbrida REST + GraphQL resulta más adecuada que cualquiera de los dos estilos por separado [@fielding2000rest; @elghazal2025restgraphql; @lawi2021graphqlrest]. GraphQL es la interfaz primaria de datos: su esquema tipado permite traer en una sola petición datos solares, meteorológicos, predicciones y estado de las baterías, lo que evita el exceso o el defecto de información de las consultas compuestas. REST queda para la transferencia de ficheros, donde el modelo basado en recursos resulta más natural.

En la **visualización**, Recharts destaca por su integración nativa con React y su modelo declarativo, frente a bibliotecas imperativas de bajo nivel como D3.js [@recharts2024docs; @bostock2011d3]: la complejidad gráfica habitual de un panel de gemelo digital se cubre sin descender al nivel primitivo de D3.

Para la **predicción de producción solar**, scikit-learn con Random Forest se elige por la evidencia comparativa revisada en el epígrafe 1.4, que lo posiciona como referencia competitiva en horizontes de hasta veinticuatro horas con un coste menor que alternativas más complejas, y por su integración inmediata con el ecosistema científico, que facilita la reproducibilidad [@pedregosa2011sklearn; @breiman2001randomforests].

La **ingeniería de características** del modelo solar se apoya en pvlib [@pvlib2024docs], que calcula, a partir de coordenadas y fecha, la posición del sol, la radiación de cielo despejado y el índice de claridad. Esto materializa la estrategia híbrida físico-estadística del epígrafe 1.4: pvlib aporta el componente físico y Random Forest aprende las relaciones no lineales residuales entre el clima y la producción observada.

Para la **detección visual del estado de los paneles**, MobileNetV2 sobre TensorFlow/Keras con *transfer learning* ofrece el mejor equilibrio entre exactitud y coste de inferencia [@sandler2018mobilenetv2; @pan2010transfer]: su arquitectura ligera corre sobre hardware estándar sin GPU dedicada, y el aprendizaje por transferencia desde ImageNet reduce drásticamente los datos y el tiempo de entrenamiento.

Finalmente, Open-Meteo es la fuente meteorológica más adecuada [@openmeteo2024]: su acceso es libre y sin autenticación, su granularidad horaria a siete días basta para los modelos previstos, y ofrece de forma nativa la irradiancia global horizontal, directamente correlacionada con la producción. Como ninguna fuente es universalmente óptima —su calidad depende de la densidad de observaciones de cada región—, la capa que obtiene estos datos se diseña sin acoplamiento rígido a una única API [@leholo2026slrsolar].

El conjunto sintetizado en la Tabla \ref{tbl:tecnologias-adecuadas} responde a un equilibrio entre madurez tecnológica, accesibilidad para un equipo académico y capacidad operativa real, y constituye el punto de partida del diseño que aborda el Capítulo 2 [@nextjs2024docs; @said2026aidt].
