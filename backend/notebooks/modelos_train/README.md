# Modelo de Predicción de Producción Solar — La Habana

Documentación del entrenamiento del modelo de Machine Learning que predice la
producción fotovoltaica del gemelo digital a partir del pronóstico meteorológico.
Esta carpeta es un **archivo reproducible** para la tesis: contiene el script de
entrenamiento, el módulo de características, el dataset usado, el modelo entrenado
y sus métricas.

> Las versiones **en producción** (las que usa el backend) son:
> - `app/services/solar_features.py` (módulo de características)
> - `models/solar_production_havana_v1.pkl` + `models/metadata_havana_v1.json`
>
> Los archivos de esta carpeta son **copias congeladas** de lo que se usó para entrenar.

---

## 1. ¿Qué problema resuelve?

Dado el **pronóstico del tiempo** para una hora (radiación, nubosidad, temperatura,
humedad, viento), predecir **cuánta energía** producirá el sistema fotovoltaico en
esa hora. Eso alimenta al gemelo digital para planificar baterías, anticipar déficit
frente a apagones, etc.

## 2. Qué estaba mal en el modelo anterior (y cómo se corrigió)

El modelo original se entrenó con un dataset de una planta de **7.7 MW en clima
frío** (temperaturas de −12 °C a 27 °C → claramente **no es La Habana**) y tenía tres
problemas que invalidaban sus métricas:

| Problema | Antes | Ahora |
|---|---|---|
| **Fuga temporal** (data leakage) | Se barajaban las horas al azar antes de separar train/test, así que el modelo "veía" horas casi idénticas a las de prueba → R² inflado artificialmente. | Separación **cronológica**: se entrena con el pasado y se valida con el futuro. Métricas honestas. |
| **Desajuste train/serve** (skew) | La nubosidad de entrenamiento se inventaba a partir de minutos de sol; en producción llegaba la nubosidad real de Open-Meteo → variables distintas. | **Un único módulo de features** compartido entre entrenamiento y backend → imposible que difieran. |
| **Ubicación y escala equivocadas** | Clima europeo + producción en kW absolutos de una planta de 7.7 MW, reescalada linealmente a la del sistema. | Datos **de La Habana** y objetivo en **factor de capacidad** (adimensional), transferible a cualquier tamaño. |

## 3. Fuentes de datos (ambas gratuitas, sin API key)

- **Objetivo (lo que el modelo aprende a predecir):** producción horaria de
  **PVGIS** (Photovoltaic Geographical Information System, del JRC de la UE) para las
  coordenadas de La Habana (23.11, −82.37), base de datos satelital **NSRDB**,
  años **2010–2015**.
- **Entradas (features):** clima histórico horario de **Open-Meteo** para las mismas
  coordenadas y horas — exactamente las **mismas variables** que el backend recibe en
  vivo cuando hace predicciones.
- Se unen por marca de tiempo UTC → **52 584 horas** (6 años) de datos.

> **Por qué dos fuentes distintas:** como no existe un sistema fotovoltaico real
> medido en La Habana, usamos PVGIS (modelo físico validado y muy citado) como
> "verdad" de producción, y Open-Meteo como las entradas que tendremos en operación.
> Que la producción venga de una fuente y el clima de otra introduce un poco de ruido
> realista y evita que el modelo sea "circular".

## 4. Características (features) — y qué significan

El modelo recibe 14 variables por hora. Las más importantes:

- **`shortwave_radiation`** — radiación solar que llega al suelo (W/m²). Es el
  predictor dominante: sin sol no hay producción.
- **`clearsky_ghi`** (radiación de *cielo despejado*) — cuánta radiación habría en esa
  hora exacta **si no hubiera ni una nube**, calculada con física solar para La Habana.
- **`clearsky_index`** (índice de claridad) — el cociente `radiación_real / cielo_despejado`.
  Vale ~1 en día claro y ~0 con cielo cubierto. **Resume la "transparencia" del cielo
  en un solo número**, independiente de la hora o estación.
- **`solar_elevation`** — qué tan alto está el Sol sobre el horizonte (grados). A
  mayor elevación, los rayos llegan más directos.
- **`effective_irradiance`** — radiación atenuada por la nubosidad.
- **`temp_loss_factor`** — los paneles pierden ~0.4 % de eficiencia por cada °C por
  encima de 25 °C; este factor lo modela.
- **`cloud_cover`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`** — clima directo.
- **`hour_sin/cos`, `month_sin/cos`** — la hora y el mes codificados de forma
  **cíclica** (para que el modelo entienda que las 23 h está "al lado" de las 0 h, y
  diciembre al lado de enero).

> Las tres primeras (`clearsky_*`, `solar_elevation`) salen de **pvlib**, una librería
> de física solar. Calculan la posición del Sol y la radiación teórica **para la
> latitud de La Habana**, lo que corrige el problema de ubicación del modelo viejo:
> la geometría no se "aprende" de datos de otro país, se **calcula** para el sitio correcto.

## 5. Entrenamiento y validación

- **Separación cronológica 80/20** sin barajar: entrena 2010–2014, valida ~2015.
- **`TimeSeriesSplit`** para el ajuste de hiperparámetros: validación cruzada que
  respeta el tiempo (siempre valida en fechas posteriores a las de entrenamiento),
  evitando la fuga.
- **Métricas separadas día/noche:** las horas nocturnas (producción = 0) son triviales
  de acertar e inflan el R². Por eso reportamos también las métricas **solo en horas de
  día**, que es lo que realmente importa.

## 6. Modelos comparados

Se entrenaron tres familias y se eligió el de menor error diurno:

| Modelo | R² (día) | RMSE diurno (% capacidad) |
|---|---|---|
| Regresión Lineal (baseline) | 0.754 | 12.4 % |
| **Random Forest** ✅ (elegido) | **0.789** | **11.4 %** |
| HistGradientBoosting (monótono) | 0.785 | 11.6 % |

Los tres convergen casi al mismo número: señal de que **el límite de precisión lo
pone el dato/física, no el algoritmo** (el clima de Open-Meteo no explica el 100 % de
la producción de PVGIS). Es un argumento fuerte de defensa.

## 7. Resultados del modelo elegido (Random Forest)

- **R² global:** 0.90  ·  **R² solo de día:** 0.79
- **RMSE diurno:** 11.4 % de la capacidad nominal (nRMSE)
- Frente al modelo viejo (R² 0.85 *inflado por fuga y sobre el sistema equivocado*),
  el nuevo da R² global **0.90 con validación honesta y para La Habana**.

## 7.5 Validación adicional: ¿fórmula física híbrida? ¿LightGBM?

Se probó la hipótesis de combinar el modelo con una **fórmula física de ingeniería FV**
(cadena PVWatts/pvlib: GHI → directa/difusa → plano del panel → temperatura de celda →
potencia DC), y se comparó con **LightGBM**. Resultados en el conjunto de prueba (horas de día):

| Método | RMSE (día) | R² (día) |
|---|---|---|
| Física sola (PVWatts/pvlib) | 0.1442 | 0.666 |
| **Random Forest (desplegado)** | **0.1145** | **0.789** |
| Ensemble RF + física (peso óptimo 0.95) | 0.1146 | 0.789 |
| RF + física como característica | 0.1147 | 0.789 |
| LightGBM (monótono) | 0.1206 | 0.766 |

**Conclusión:** ni el ensemble físico ni LightGBM mejoran al Random Forest. La fórmula
física, alimentada con la misma radiación de Open-Meteo, no aporta información independiente:
el modelo ya internalizó la física al entrenar sobre PVGIS, y el error dominante (diferencia
entre la radiación de Open-Meteo y la de PVGIS) afecta por igual a ambos. El experimento
completo está en `experimento_fisica_ensemble.py` y en el anexo del cuaderno.

> La fórmula física **sí** sería valiosa con **producción medida real** (corrección de
> residuos, *physics-informed ML*) o como salvaguarda de robustez en condiciones extremas.

## 8. Integración con el gemelo digital

El modelo **no predice kW directamente**, predice el **factor de capacidad** (0–1):
qué fracción de su potencia máxima entrega el sistema. El backend lo multiplica por la
**capacidad real del sistema, leída en tiempo real de los paneles configurados en la
base de datos** (`getSystemConfig` suma `potencia × cantidad` de cada panel):

```
producción_kW = factor_de_capacidad × capacidad_de_los_paneles_en_la_BD
```

**Ventaja clave:** el mismo modelo sirve para cualquier tamaño de instalación. Si
mañana se agregan o quitan paneles en la BD, la predicción se ajusta sola, sin
reentrenar nada.

## 9. Cómo reproducir

```bash
cd tesis_gemelo_digital/backend
source venv/bin/activate
python notebooks/train_solar_havana.py      # descarga datos, entrena y guarda el modelo
```

Requiere: `pvlib`, `scikit-learn`, `pandas`, `httpx`, `joblib` (ver `requirements.txt`).

## 10. Archivos de esta carpeta

| Archivo | Qué es |
|---|---|
| `modelo_solar_havana.ipynb` | **Cuaderno de tesis**: EDA, entrenamiento, evaluación y gráficas (ya ejecutado) |
| `train_solar_havana.py` | Script de entrenamiento (descarga, entrena, evalúa, guarda) |
| `experimento_fisica_ensemble.py` | Experimento: física PVWatts vs ML, ensemble y LightGBM |
| `solar_features.py` | Módulo de ingeniería de características (copia del de `app/services/`) |
| `havana_solar_training.csv` | Dataset final usado (52 584 horas, features + objetivo) |
| `solar_production_havana_v1.pkl` | Modelo Random Forest entrenado |
| `metadata_havana_v1.json` | Configuración, features y métricas del modelo |

---

## Glosario rápido (conceptos explicados fácil)

- **Factor de capacidad:** fracción de la potencia máxima que entrega el sistema. Un
  panel de 10 kW que produce 4 kW tiene factor 0.4. Es adimensional → sirve para
  cualquier tamaño.
- **Data leakage (fuga de datos):** cuando el modelo "se entera" durante el
  entrenamiento de información que no tendría en la realidad, dando métricas falsamente
  buenas. Aquí pasaba al barajar horas consecutivas (casi idénticas) entre train y test.
- **Train/serve skew:** cuando las features con que se entrena no son idénticas a las
  que se usan en producción. Se evita compartiendo el mismo código de features.
- **Índice de claridad (clear-sky index):** radiación real ÷ radiación teórica con
  cielo despejado. Mide en una sola cifra qué tan nublado/transparente está el cielo.
- **pvlib:** librería de física solar que calcula la posición del Sol y la radiación
  teórica para unas coordenadas y fecha dadas (sin datos, pura astronomía/física).
- **Random Forest:** muchos árboles de decisión entrenados sobre subconjuntos
  aleatorios; cada uno "vota" y se promedia. Robusto y sin necesidad de escalar datos.
- **Gradient Boosting / HistGradientBoosting:** árboles que se entrenan **en
  secuencia**, cada uno corrigiendo el error del anterior. Suele ser muy preciso.
- **Restricción monótona:** se le impone al modelo que "a más radiación, nunca menos
  producción", forzando coherencia física.
- **RMSE / MAE / R²:** medidas de error. RMSE penaliza más los errores grandes; MAE es
  el error medio absoluto; R² es la fracción de la variabilidad explicada (1 = perfecto).
- **nRMSE:** el RMSE expresado como % de la capacidad, para interpretarlo fácil.
