## Escenario experimental

El gemelo digital se diseñó como sistema genérico, pero su evaluación requiere un caso concreto sobre el cual ejercitar todas sus capacidades. El escenario elegido es la microrred fotovoltaica de la Universidad Tecnológica de La Habana "José Antonio Echeverría" (CUJAE), en La Habana (latitud 23,1136°, longitud −82,3666°). Se eligió por tres razones: cuenta con una microrred fotovoltaica en operación que reproduce el objeto de estudio, sus parámetros de configuración son accesibles, y su clima tropical caribeño está poco representado en la literatura comparativa, que se concentra en climas mediterráneo, desértico y templado [@dhimish2025reliability].

Todos los parámetros del sitio (capacidad fotovoltaica, capacidad de almacenamiento, ubicación y perfiles de consumo) se cargan en las colecciones documentales descritas en el Capítulo 2, sin código específico del emplazamiento; desplegar el sistema en otra microrred solo exige actualizar esas colecciones [@kumar2020microgrid; @mongodb2024docs]. La fuente meteorológica activa es Open-Meteo, alineada con la zona horaria local, pero el sistema admite registrar y conmutar otras fuentes sin tocar el código [@openmeteo2024].

La evaluación se apoya en dos conjuntos de datos. Para la predicción de la generación se usa un dataset de La Habana que une las variables climáticas horarias de Open-Meteo con la producción fotovoltaica de PVGIS (base de datos satelital del Joint Research Centre de la Comisión Europea) para el período 2010–2015, con 52 584 horas tras la unión por marca de tiempo; usar las mismas variables que el sistema recibe en operación elimina por construcción el desajuste entre entrenamiento y producción. Para la clasificación de limpieza se usa un dataset de 2 562 imágenes etiquetadas (1 493 limpias y 1 069 con polvo), dividido en 2 051 de entrenamiento y 511 de validación [@lodhi2023faultpv]. A ello se suman las series que la propia microrred genera en línea durante la ejecución del sistema. La Tabla \ref{tbl:escenario} resume los parámetros que definen el escenario experimental.

| Parámetro | Valor / configuración |
|---|---|
| Emplazamiento | Microrred fotovoltaica de la CUJAE, La Habana |
| Coordenadas | 23,1136° N, 82,3666° O |
| Zona horaria | América/La Habana |
| Fuente meteorológica activa | Open-Meteo (conmutable por configuración) |
| Capacidad fotovoltaica y de almacenamiento | Según la configuración del sitio (colecciones de paneles y baterías) |
| Dataset de generación | PVGIS + Open-Meteo, La Habana, 2010–2015 (52 584 horas) |
| Variable objetivo de generación | Factor de capacidad (0–1) |
| Dataset de limpieza de paneles | 2 562 imágenes (1 493 limpias, 1 069 con polvo) |

: Parámetros del escenario experimental. {#tbl:escenario}
