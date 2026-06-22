## Conclusiones del capítulo

Del análisis y el diseño de la solución se concluye que:

- El gemelo digital se organiza en cuatro módulos (datos, analítica, simulación e interfaz) que separan responsabilidades y permiten su evolución independiente.
- Los requisitos funcionales y no funcionales, junto con las restricciones del entorno, fijan criterios de calidad explícitos y acotan el alcance a una herramienta de apoyo a la decisión.
- Un monolito modular cliente–servidor, con comunicación por GraphQL y el cliente desacoplado de la base de datos, ofrece el equilibrio adecuado entre simplicidad y extensibilidad para el alcance del proyecto.
- Las cuatro vistas arquitectónicas (cliente–servidor, n-capas, flujo de datos y repositorio) y el diseño documental en catorce colecciones sostienen la reutilización y la flexibilidad del sistema.
- Los patrones Adapter, Strategy, Controller e Indirección desacoplan las integraciones externas, la predicción, la comunicación y la persistencia, lo que facilita su sustitución y su prueba.
- El despliegue en contenedores y la integración con Open-Meteo y el directorio LDAP hacen el sistema reproducible y portable a la infraestructura de la universidad.

Con el diseño definido, el Capítulo 3 somete la solución a un análisis experimental, tomando la microrred de la CUJAE como escenario: entrena y evalúa los modelos, comprueba el sistema mediante casos de prueba y muestra su funcionamiento.
