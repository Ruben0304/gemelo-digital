## Operación del sistema en el escenario de la CUJAE

Más allá de las pruebas, el sistema se ejecutó configurado para la microrred de la CUJAE, con datos meteorológicos en vivo de Open-Meteo y los parámetros del sitio, para mostrar su funcionamiento. Como el alcance excluye la integración con sensores físicos, la generación, el estado de carga y los flujos que presenta el sistema son la estimación de los modelos a partir del clima y de la ficha técnica de los equipos, no una telemetría medida en la instalación. El tablero principal (Figura \ref{fig:dash-gen}) reúne, sobre un esquema de la microrred, la potencia generada, el estado de carga de las baterías y los flujos de energía del momento, junto con las condiciones meteorológicas y el pronóstico a varios días.

![Tablero principal con el flujo energético, los indicadores de generación y el panel meteorológico.](../recursos/figuras/fig2_dashboard_generacion.png){#fig:dash-gen width=95%}

El gráfico de producción frente a consumo (Figura \ref{fig:graf-gc}) superpone la generación prevista por el Random Forest y la demanda estimada, con la energía diaria y el balance neto, lo que permite anticipar desajustes y picos antes de que ocurran. El panel meteorológico (Figura \ref{fig:clima}) integra las condiciones actuales y el pronóstico de Open-Meteo con la producción estimada para cada día.

![Predicción de producción fotovoltaica frente a consumo, con las métricas de energía y balance.](../recursos/figuras/fig3_grafico_generacion_consumo.png){#fig:graf-gc width=80%}

![Panel de datos climáticos con el pronóstico extendido de Open-Meteo.](../recursos/figuras/fig4_datos_climaticos.png){#fig:clima width=70%}

A partir de estas predicciones, el gemelo emite alertas por severidad: críticas cuando el nivel de batería previsto baja del 20 %, de advertencia bajo el 40 % o ante un déficit superior al 50 % del consumo, e informativas para condiciones meteorológicas reseñables. Y estima la autonomía respondiendo, mediante una simulación horaria que reutiliza los dos modelos ya evaluados, cuánto tiempo podría operar la microrred de forma autónoma; el resultado alimenta las alertas y la planificación de mantenimientos [@wang2023isolatedmg; @tao2019dt].

Esa estimación se materializa en un simulador interactivo de autonomía (Figura \ref{fig:sim-bateria}), que proyecta hora a hora la evolución del estado de carga a partir de la generación y el consumo previstos y la acota con bandas optimista y pesimista derivadas de los márgenes de error de ambos modelos. El operador puede ensayar escenarios (reducir el consumo, variar la condición de los paneles o ampliar el horizonte) y leer de inmediato la hora estimada de agotamiento, el cruce de los umbrales crítico y de advertencia, y el balance neto de las próximas horas.

![Simulador de autonomía de la batería: proyección horaria del estado de carga con bandas de incertidumbre.](../recursos/figuras/fig20_simulador_bateria.png){#fig:sim-bateria width=95%}

La gestión del inventario y la configuración se concentran en una sección de administración (Figura \ref{fig:admin}), donde se editan los paneles, las baterías, las cargas, el perfil de consumo, las fuentes de clima y la ubicación. Esa configuración por datos es la que sostiene la transferibilidad: desplegar el sistema en otra microrred se reduce a registrar sus paneles y baterías, fijar la ubicación geográfica y cargar los perfiles de consumo, sin escribir una línea de código [@kumar2020microgrid; @dhimish2025reliability].

![Sección de administración del inventario de activos y de la configuración del sistema.](../recursos/figuras/fig5_dashboard_administracion.png){#fig:admin width=95%}

Dos herramientas especializadas afinan esa configuración. El simulador de sombras (Figura \ref{fig:sim-sombras}) construye un perfil de sombreado por franja horaria solar a partir de la ubicación de la instalación y de la posición del sol, que el operador ajusta manualmente y que corrige las estimaciones de generación; su sombra promedio diaria alimenta, además, al simulador de autonomía. El editor del perfil de consumo (Figura \ref{fig:perfil-consumo}) define la curva horaria de demanda por tipo de día, base de la predicción del consumo mientras no se acumule suficiente histórico, y ofrece perfiles de referencia para distintos tipos de instalación.

![Simulador de sombras: perfil de sombreado por franja horaria solar de la instalación.](../recursos/figuras/fig21_simulador_sombras.png){#fig:sim-sombras width=95%}

![Editor del perfil de consumo horario por tipo de día.](../recursos/figuras/fig22_perfil_consumo.png){#fig:perfil-consumo width=88%}
