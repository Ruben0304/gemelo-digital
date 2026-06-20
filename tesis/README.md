# Tesis de Diploma — Gemelo Digital para Microrred Fotovoltaica

**Institución:** CUJAE (Instituto Superior Politécnico José Antonio Echeverría), La Habana, Cuba
**Facultad:** Ingeniería Informática
**Carrera:** Ingeniería en Ciencias Informáticas
**Autores:** Rubén Hernández Acevedo · Fabián Fernández Gálvez
**Tutores:** Dr.C. Nayma Cepero Pérez · Ms.C. Ernesto Alberto Álvarez
**Defensa prevista:** Junio de 2026

**Título:** Gemelo Digital para una Microrred Fotovoltaica: Monitoreo en Tiempo Real, Predicciones Inteligentes y Simulación de Autonomía Energética

---

## Qué es este proyecto

Sistema de gemelo digital para una microrred fotovoltaica. Implementa monitoreo en tiempo real, predicciones de producción y consumo con horizonte de 24 horas usando Machine Learning, y simulación de autonomía energética del almacenamiento en el contexto cubano.

Esta carpeta `tesis/` vive **dentro del repositorio del software** (`gemelo-digital/`) y contiene únicamente el documento de tesis escrito en Markdown, compilado a PDF con pandoc + XeLaTeX. El código fuente está en la raíz del repo, un nivel por encima (`../`).

Para entender el software antes de escribir sobre él, leer primero:
- `../frontend/CLAUDE.md` — documentación técnica del frontend (Next.js 15, React 19, TypeScript)
- `../frontend/src/` — UI, componentes y lógica del cliente
- `../backend/app/` — API (FastAPI) y lógica de negocio (cálculos, predicciones, configuración del sistema)
- `../backend/notebooks/` y `../backend/models/` — notebooks de ML y modelos entrenados

**No asumir ni inventar valores concretos del sistema** (capacidades, ubicación, parámetros). Leer el código fuente o preguntar al autor.

---

## Estructura de Directorios

```
gemelo-digital/                   ← repositorio del software (raíz)
├── backend/                      ← API FastAPI, modelos ML, notebooks
├── frontend/                     ← UI Next.js 15 / React 19
├── servidor_clima_mock/          ← mock del servicio de clima
└── tesis/                        ← ESTA CARPETA (documento de tesis)
    ├── README.md                 ← este archivo (leer primero)
    ├── COMMANDS.md               ← orden canónico + comandos pandoc
    ├── index.md                  ← YAML de pandoc (solo metadatos)
    ├── referencias.bib           ← único archivo BibTeX de la tesis
    ├── ieee.csl                  ← estilo de citas IEEE (descargado)
    ├── logo.png                  ← escudo CUJAE (usado en la portada)
    ├── diagramas/                ← fuentes editables PlantUML (.puml) de las figuras
    │
    ├── extras/                   ← front matter institucional
    │   ├── portada.tex           ← portada CUJAE en LaTeX puro
    │   ├── declaracion_autoria.md
    │   ├── pensamiento.md
    │   ├── dedicatoria.md
    │   ├── agradecimientos.md
    │   ├── resumen_es.md         ← resumen en español (≤300 palabras)
    │   ├── resumen_en.md         ← abstract en inglés (≤300 palabras)
    │   ├── acronimos.md          ← lista de acrónimos
    │   ├── simbolos.md           ← lista de símbolos
    │   └── prologo.md            ← NO se incluye en la compilación por defecto
    │
    ├── introduccion/
    │   └── introduccion.md
    │
    ├── capitulo1/                ← Marco Teórico y Estado del Arte
    │   ├── introduccion.md
    │   ├── subcapitulo1_problema.md
    │   ├── subcapitulo2_sistemas_digitales.md
    │   ├── subcapitulo3_gemelo_digital.md
    │   ├── subcapitulo4_inteligencia_artificial.md
    │   ├── subcapitulo5_tecnologias.md
    │   └── conclusion.md
    │
    ├── capitulo2/                ← Diseño e Implementación
    │   ├── introduccion.md
    │   ├── subcapitulo1_arquitectura_sistema.md
    │   ├── subcapitulo2_implementacion.md
    │   ├── subcapitulo3_modelos_ml.md
    │   └── conclusion.md
    │
    ├── capitulo3/                ← Validación y Resultados Experimentales
    │   ├── introduccion.md
    │   ├── subcapitulo1_estrategia.md
    │   ├── subcapitulo2_solar.md
    │   ├── subcapitulo3_cnn.md
    │   ├── subcapitulo4_funcional.md
    │   ├── subcapitulo5_caso_cujae.md
    │   └── conclusion.md
    │
    ├── conclusion/
    │   └── conclusion.md
    │
    ├── recomendaciones/          ← sección obligatoria CUJAE, separada de Conclusiones
    │   └── recomendaciones.md
    │
    ├── anexos/                   ← código extenso, datasheets, gráficas extra
    │   └── anexo_a.md
    │
    ├── recursos/
    │   ├── capturas/             ← screenshots del software
    │   ├── validacion/           ← gráficas de validación de modelos ML
    │   └── figuras/              ← diagramas de arquitectura, UML, esquemas
    │
    └── outputs/                  ← artefactos generados (ignorados por git)
        ├── debug/                ← destino POR DEFECTO (drafts, iteraciones)
        └── release/              ← solo entregas oficiales (modo producción)
```

**Carpetas de salida:** todos los PDFs, .docx, .tex y .html generados van a `outputs/debug/` por defecto. Para compilar en `outputs/release/` (entregas oficiales), exportar `OUT=outputs/release` antes de los comandos. Ver `COMMANDS.md`.

---

## Orden Canónico CUJAE (resumen)

El orden completo y los comandos están en `COMMANDS.md`. Resumen del orden:

**Front matter:** Portada → Declaración de Autoría → Pensamiento → Dedicatoria → Agradecimientos → Resumen (es) → Abstract (en) → Índice/LOF/LOT (auto) → Acrónimos → Símbolos

**Cuerpo:** Introducción → Capítulo 1 → Capítulo 2 → Capítulo 3 → Conclusiones → Recomendaciones

**Back matter:** Referencias (auto vía citeproc) → Anexos

> `index.md` solo contiene el YAML de pandoc. El orden de archivos en la compilación vive en `COMMANDS.md` para evitar duplicación.

---

## Contenido de Cada Capítulo

### Capítulo 1 — Marco Teórico y Estado del Arte
Fundamentos teóricos: gemelos digitales, microrredes fotovoltaicas, almacenamiento en baterías, integración climática. Revisión de trabajos previos. Identifica las brechas que justifican esta investigación.

### Capítulo 2 — Diseño e Implementación
Arquitectura del sistema, stack tecnológico, diseño de base de datos, algoritmos de cálculo de producción solar, estrategia de batería, motor de predicciones, modelos de ML. Todo lo que se describe aquí **debe verificarse contra el código real** en `../tesis_gemelo_digital/`.

### Capítulo 3 — Validación, Resultados y Análisis
Validación de modelos contra datos reales, métricas de error, estimación de autonomía del almacenamiento, evaluación de resiliencia energética.

---

## Front / Back Matter — qué va en cada archivo

| Archivo | Propósito | Notas de formato |
|---|---|---|
| `extras/portada.tex` | Portada CUJAE oficial | LaTeX puro. Se inyecta con `--include-before-body`. Para editar nombres/título, abrir y modificar las macros directamente. |
| `extras/declaracion_autoria.md` | Declaración firmada de autoría | Mezcla markdown + LaTeX (firmas con `\rule`). Se imprime y firma a mano antes de entregar. |
| `extras/pensamiento.md` | Cita o frase introductoria | Una sola página, centrada a la derecha, sin numerar. |
| `extras/dedicatoria.md` | Dedicatoria personal | Una sola página, centrada a la derecha, sin numerar. |
| `extras/agradecimientos.md` | Agradecimientos formales | Tutores primero, luego institución, luego familia. |
| `extras/resumen_es.md` | Resumen en español (≤300 palabras) | Debe cubrir: problema, metodología, resultados, conclusión. Termina con palabras clave. |
| `extras/resumen_en.md` | Abstract en inglés (≤300 palabras) | Traducción del resumen español. |
| `extras/acronimos.md` | Lista alfabética de acrónimos | Usa `\begin{description}`. Ver formato existente. |
| `extras/simbolos.md` | Lista de símbolos matemáticos | Variables físicas (P, G, η, etc.) con unidades. |
| `recomendaciones/recomendaciones.md` | Trabajo futuro | Cada recomendación es concreta y accionable. **No mezclar con conclusiones.** |
| `anexos/anexo_*.md` | Material complementario | Código extenso, datasheets, tablas de datos crudos. Un archivo por anexo. |

---

## Estructura Interna de Cada Archivo Markdown

Todos los archivos deben seguir **exactamente** este esquema de encabezados. No hay excepciones.

### Archivos `capitulo*/introduccion.md`
```markdown
# Capítulo N: Título del Capítulo

## Introducción al capítulo

Texto...
```

### Archivos `capitulo*/subcapituloN_*.md`
```markdown
## Título de la Sección Principal

### Título de Subsección

Texto...
```

### Archivos `capitulo*/conclusion.md`
```markdown
## Conclusiones del Capítulo N

Texto...
```

### `introduccion/introduccion.md`, `conclusion/conclusion.md`, `recomendaciones/recomendaciones.md`
```markdown
# Título (Introducción General / Conclusiones Generales / Recomendaciones)

## Primera sección

Texto...
```

### `extras/*.md` y `anexos/*.md`
```markdown
# Título (Resumen / Abstract / Acrónimos / Anexo A / ...)

Texto...
```

**Regla crítica de encabezados:**
- `#` (H1): solo en archivos de nivel "capítulo o sección mayor" (introduccion, conclusion, recomendaciones, extras, anexos, y los `introduccion.md` de cada capítulo)
- `##` (H2): secciones principales — en los subcapítulos es el nivel inicial
- `###` (H3): subsecciones
- No usar `####` ni niveles más profundos — pandoc los aplana incorrectamente en LaTeX

**Ningún archivo de capítulo lleva bloque YAML `---` al inicio.** Solo `index.md` tiene frontmatter YAML.

---

## Convenciones de Marcado (usar siempre estas, nunca otras)

### Citas bibliográficas
```markdown
Según Grieves [-@grieves2014digital], el gemelo digital es...
El concepto fue formalizado en [@grieves2014digital].
Múltiples autores coinciden [@ref1; @ref2; @ref3].
```
Todas las claves deben existir en `referencias.bib`. Ver sección de verificación en `COMMANDS.md`.

### Figuras
```markdown
![Descripción de la figura.](../recursos/capturas/nombre_imagen.png){width=80%}
```
- Con `--resource-path` configurado en los comandos, también funciona la ruta corta: `![desc](nombre_imagen.png){width=80%}`
- Siempre incluir `{width=XX%}` para control de tamaño en LaTeX
- Siempre terminar la descripción con punto

### Tablas
```markdown
| Columna A | Columna B | Columna C |
|-----------|-----------|-----------|
| valor     | valor     | valor     |

: Título de la tabla. {#tbl:etiqueta}
```
Para tablas complejas usar LaTeX directo en el `.md` con `\begin{table}[H]`.

### Ecuaciones
Inline: `$símbolo$` o `$fórmula$`

Bloque numerado:
```markdown
$$
P = \frac{G \cdot A \cdot \eta}{1000}
$$ {#eq:etiqueta}
```

### Bloques de código fuente
````markdown
```typescript
const ejemplo = true;
```
````
Siempre especificar el lenguaje (`typescript`, `python`, `bash`, `json`, etc.).

### Énfasis
- **Negrita** `**texto**`: términos técnicos la primera vez que aparecen, nombres de componentes del sistema
- *Cursiva* `*texto*`: títulos de obras, palabras en otro idioma, énfasis suave
- Usar solo `**` y `*` (nunca `__` ni `_` simple)

### Listas
Usar `-` para listas no ordenadas (nunca `*` ni `+`). Usar `1.` para listas ordenadas.

### Referencias cruzadas internas
```markdown
Como se muestra en la Figura \ref{fig:etiqueta}...
Ver la Tabla \ref{tbl:etiqueta}...
La ecuación \ref{eq:etiqueta} describe...
```

---

## Reglas para Agentes

1. **Leer el código antes de escribir sobre él.** Los valores concretos del sistema (parámetros, algoritmos, métricas) están en `../tesis_gemelo_digital/src/lib/`. No inventar ni suponer.

2. **Respetar la estructura de encabezados.** Un subcapítulo nunca abre con `#`. Un `introduccion.md` de capítulo siempre abre con `#`. Ver la sección anterior.

3. **No crear archivos `.bib` adicionales.** Todo va en `referencias.bib`.

4. **No renombrar archivos existentes** sin actualizar `COMMANDS.md` en simultáneo.

5. **Las imágenes van en `recursos/`** según tipo. Con `--resource-path` la ruta puede ser corta; si se prefiere, usar la ruta relativa explícita.

6. **Al añadir un archivo `.md` nuevo**: crear el archivo → añadirlo en TODOS los comandos de `COMMANDS.md` (PDF, .docx, .tex, .html, conteo). `index.md` no se toca.

7. **Idioma:** cuerpo de la tesis en español formal. Solo `extras/resumen_en.md` en inglés.

8. **Front matter institucional (portada, declaración, pensamiento, dedicatoria):** no son contenido académico — son páginas de cumplimiento normativo CUJAE. Editar con cuidado y respetando el formato existente.

9. **Para compilar:** ver `COMMANDS.md`. No improvisar flags de pandoc.
