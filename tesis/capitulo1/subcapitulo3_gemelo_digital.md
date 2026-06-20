## Soluciones afines: trabajos académicos y plataformas comerciales

La idea de un gemelo digital para instalaciones fotovoltaicas no es nueva, y conviene situar la propuesta frente a lo que ya ofrecen la investigación y el mercado.

En el plano académico, Casillo y otros proponen una metodología de monitoreo predictivo para sistemas fotovoltaicos que integra IoT, BIM y GIS dentro de una arquitectura de gemelo digital [@casillo2025dtpv]. Lope y otros presentan un gemelo digital basado en inteligencia artificial para un sistema energético residencial con hidrógeno, con técnicas predictivas multivector [@lope2025dthydrogen]. Han y Ai aplican algoritmos genéticos sobre el gemelo digital de un edificio para optimizar su gestión energética [@han2025dtbuilding]. Son trabajos sólidos, pero cada uno atiende una parte del problema y se valida en un único escenario, sin integrarse en un sistema operativo con interfaz para el usuario.

En el plano comercial, los fabricantes ofrecen plataformas de monitoreo en la nube asociadas a su propio hardware: FusionSolar de Huawei, SolarEdge Monitoring, Enphase Enlighten o FSolar de Felicity [@huawei2024fusionsolar; @solaredge2024monitoring; @enphase2024enlighten; @felicity2024fsolar]. Todas muestran la generación y el estado de los equipos en tiempo real con buena calidad, pero comparten tres límites para el problema que aquí se aborda: funcionan solo con el hardware del propio fabricante, se limitan a visualizar lo que ocurre sin predecir ni simular, y están pensadas para instalaciones conectadas a la red, no para microrredes aisladas, donde la gestión del almacenamiento es decisiva [@wang2023isolatedmg].

La Tabla \ref{tbl:soluciones} contrasta estas soluciones con las capacidades que requiere una microrred fotovoltaica aislada.

| Solución | Tipo | Predicción | Simulación | Aislada | Indep. fab. | Transf. |
|---|---|---|---|---|---|---|
| Casillo et al. [@casillo2025dtpv] | Académica | Parcial | No | No | — | No |
| Lope et al. [@lope2025dthydrogen] | Académica | Sí | Parcial | No | — | No |
| Han y Ai [@han2025dtbuilding] | Académica | No | Sí | No | — | No |
| FusionSolar [@huawei2024fusionsolar] | Comercial | No | No | No | No | No |
| SolarEdge [@solaredge2024monitoring] | Comercial | No | No | No | No | No |
| Enphase Enlighten [@enphase2024enlighten] | Comercial | No | No | No | No | No |
| FSolar [@felicity2024fsolar] | Comercial | No | No | No | No | No |
| **Propuesta de esta tesis** | Académica | Sí | Sí | Sí | Sí | Sí |

: Comparación de soluciones afines frente a las capacidades requeridas por una microrred fotovoltaica aislada. {#tbl:soluciones}

Del contraste se desprende la brecha que esta investigación busca cubrir. Ninguna de las soluciones revisadas reúne, a la vez, predicción mediante inteligencia artificial, simulación de la autonomía del almacenamiento, enfoque en la operación aislada e independencia del fabricante (Tabla \ref{tbl:soluciones}). Las plataformas comerciales son potentes en visualización, pero cerradas y descriptivas; las propuestas académicas incorporan predicción o simulación, pero de forma parcial y atada a un único caso. El gemelo digital propuesto se ubica precisamente en ese espacio desatendido: integra monitoreo, predicción y simulación en un sistema web único, no depende del fabricante del hardware y guarda en datos toda la configuración del emplazamiento, de modo que puede trasladarse a otra microrred sin reescribir el código. Las técnicas de inteligencia artificial que hacen posibles esas capacidades se examinan a continuación.
