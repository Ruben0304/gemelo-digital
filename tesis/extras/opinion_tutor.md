# Opinión del tutor {.unnumbered .unlisted}

**Título:** Gemelo digital para una microrred fotovoltaica aislada

**Autores:** Rubén Hernández Acevedo y Fabián Fernández Gálvez

El presente trabajo de tesis constituye una propuesta técnica rigurosa y pertinente, que responde de manera precisa a una problemática real y sensible dentro del país. Los autores abordan el problema de la gestión de la energía en microrredes eléctricas aisladas desde una mirada diferente, con el propósito del desarrollo de un gemelo digital web para estas, tomando como caso de estudio la microrred de la Universidad Tecnológica de La Habana «José Antonio Echeverría» (CUJAE). Es importante destacar que este trabajo es posible escalarlo a cualquier sistema eléctrico.

Los autores, para la creación de un gemelo digital, realizaron un diagnóstico exhaustivo de las diferentes tecnologías, haciendo la comparación entre las específicas agrupadas por su rol funcional (frontend, backend, persistencia, comunicación, visualización y soporte).

El diseño del gemelo digital propuesto es una plataforma web que representa de forma virtual y dinámica una microrred aislada, organizada en cuatro módulos bien definidos que integran los datos de operación, los modelos de predicción, la simulación del almacenamiento y una interfaz web para asistir al operador en la toma de decisiones.

La selección de la arquitectura se basó en la integración de cuatro criterios una complejidad operativa abordable por un equipo de pregrado; la evolución modular; la escalabilidad progresiva; y la posibilidad de razonar de forma explícita sobre los atributos de calidad.

Con ellos, los autores adoptan un monolito modular cliente–servidor: un cliente web en Next.js sobre React y un servidor en Python (FastAPI) que concentra la lógica de negocio, el acceso a datos y la analítica. Ambos se comunican exclusivamente mediante una API GraphQL, y el cliente no accede, en ningún caso, directamente a la base de datos. Esta opción se ajusta al alcance del trabajo realizado y mantiene la complejidad manejable sin renunciar a la escalabilidad.

La familia de algoritmos utilizados para que el gemelo digital presentara eficientemente las capacidades de anticipar la generación, anticipar la demanda y diagnosticar el estado del sistema son los algoritmos de aprendizaje automático, tales como el árbol de decisión, Random Forest y la potenciación por gradiente, como XGBoost. El sistema emplea, en sus tareas de predicción, métodos de ensamble que ofrecen un compromiso adecuado para el balance de energía, y un problema de visión por computadora para ver el estado de clasificar imágenes de los paneles en limpio o sucio, mediante una red neuronal convolucional.

La evaluación mediante métricas robustas mostró que el diseño se sostiene en condiciones de uso y que su despliegue en otra microrred se reduce a actualizar la configuración.

Más allá de los resultados técnicos, es fundamental resaltar la calidad profesional y humana demostrada por Ruben y Fabian a lo largo de este proceso que le aporta a los resultados de un proyecto nacional.

Durante el desarrollo de la investigación, los estudiantes han exhibido un alto sentido de responsabilidad, disciplina y una capacidad analítica. Su habilidad para implementación práctica de algoritmos de aprendizaje automático entrenados con datos locales, el dominio del diseño de sistemas cliente-servidor, así como la integración y la gestión de los datos que alimentan los diferentes modelos, demuestran sus destrezas y una madurez académica.

Los estudiantes tuvieron que aprender de términos y conceptos que no están en el perfil del ingeniero informático para poder entender como es el funcionamiento de una microrred aislada.

En conclusión, el trabajo de Rubén Hernández Acevedo y Fabián Fernández Gálvez cumple satisfactoriamente con todas las exigencias académicas y técnicas requeridas. Los estudiantes han demostrado no solo ser capaz de entregar un artefacto funcional para la CUJAE, sino también poseer la capacidad investigativa y el rigor científico necesarios para enfrentar futuros retos profesionales con éxito. Por todo lo anterior, le solicitamos al tribunal que otorgue al trabajo máxima calificación de 5 puntos, Excelente.

\vspace{1.6cm}

\noindent
\begin{minipage}{0.45\textwidth}
\centering
\includegraphics[height=1.3cm]{recursos/figuras/firma_nayma.png}\\[-2pt]
\rule{6cm}{0.4pt}\\[2pt]
Dra. C. Nayma Cepero Pérez\\
\textit{Tutora}
\end{minipage}\hfill
\begin{minipage}{0.45\textwidth}
\centering
\includegraphics[height=1.3cm]{recursos/figuras/firma_ernesto.png}\\[-2pt]
\rule{6cm}{0.4pt}\\[2pt]
Ms. C. Ernesto Alberto Alvarez\\
\textit{Tutor}
\end{minipage}

\vspace{1.2cm}

\noindent La Habana, Cuba

\noindent 21 de junio de 2026

\newpage
