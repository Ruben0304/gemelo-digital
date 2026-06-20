# Comandos de Compilación — Tesis Gemelo Digital

Referencia de todos los comandos para compilar, verificar y mantener la tesis.
**Ejecutar siempre desde la raíz de esta carpeta** (`gemelo-digital/tesis/`).

Este archivo es la **única fuente de verdad** del orden de compilación. `index.md` solo contiene el YAML de pandoc.

---

## Carpetas de Salida — debug vs release

Todos los artefactos generados (PDF, .docx, .tex, .html, drafts) se escriben en `outputs/`:

- **`outputs/debug/`** — destino **por defecto** para borradores, iteraciones de trabajo, drafts de capítulos sueltos, conteos de palabras. Compilación rápida, no representa entrega oficial.
- **`outputs/release/`** — solo para versiones que se entregan al tutor o al tribunal. Compilar aquí únicamente cuando se cambia explícitamente al modo producción.

**Regla operativa:** mientras no se diga "modo producción" o "modo release", **todos los comandos escriben en `outputs/debug/`**. La variable `$OUT` al inicio de cada bloque controla el destino:

```bash
# Por defecto (debug): nada que hacer
# Para producción, exportar antes de ejecutar los comandos:
export OUT=outputs/release
```

Si `$OUT` no está definida, los comandos asumen `outputs/debug`.

---

## Requisitos Previos

```bash
# Verificar instalaciones
pandoc --version
xelatex --version

# Instalar (macOS)
brew install pandoc
brew install --cask mactex
```

`ieee.csl` debe estar en la raíz (ya descargado). Si se perdiera:
```bash
curl -sSL -o ieee.csl https://raw.githubusercontent.com/citation-style-language/styles/master/ieee.csl
```

---

## Orden Canónico de Archivos (norma CUJAE)

El orden CUJAE para una tesis de pregrado es:

1. **Portada** — vía `--include-before-body=extras/portada.tex` (LaTeX puro)
2. **Declaración de Autoría** — `extras/declaracion_autoria.md`
3. **Pensamiento** — `extras/pensamiento.md`
4. **Dedicatoria** — `extras/dedicatoria.md`
5. **Agradecimientos** — `extras/agradecimientos.md`
6. **Resumen (español)** — `extras/resumen_es.md`
7. **Abstract (inglés)** — `extras/resumen_en.md`
8. **Índice general, índice de figuras, índice de tablas** — generados automáticamente por pandoc (`toc`, `lof`, `lot` en YAML)
9. **Lista de Acrónimos** — `extras/acronimos.md`
10. **Lista de Símbolos** — `extras/simbolos.md`
11. **Introducción** — `introduccion/introduccion.md`
12. **Capítulo 1** — Marco Teórico y Estado del Arte
13. **Capítulo 2** — Diseño e Implementación
14. **Capítulo 3** — Validación, Resultados y Análisis
15. **Conclusiones generales** — `conclusion/conclusion.md`
16. **Recomendaciones** — `recomendaciones/recomendaciones.md`
17. **Referencias bibliográficas** — generadas automáticamente por `--citeproc`
18. **Anexos** — `anexos/anexo_a.md` (y los que se añadan)

> Nota: `extras/prologo.md` **no se incluye** en la compilación por defecto (los prólogos no son típicos en tesis de pregrado CUJAE). Si se decide incluir, va entre Agradecimientos y Resumen.

---

## Compilación Principal

### PDF completo

```bash
OUT="${OUT:-outputs/debug}"
mkdir -p "$OUT"
pandoc \
  index.md \
  extras/declaracion_autoria.md \
  extras/agradecimientos.md \
  extras/resumen_es.md \
  extras/resumen_en.md \
  extras/acronimos.md \
  extras/simbolos.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_problema.md \
  capitulo1/subcapitulo2_sistemas_digitales.md \
  capitulo1/subcapitulo3_gemelo_digital.md \
  capitulo1/subcapitulo4_inteligencia_artificial.md \
  capitulo1/subcapitulo5_tecnologias.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_estrategia.md \
  capitulo3/subcapitulo2_solar.md \
  capitulo3/subcapitulo3_cnn.md \
  capitulo3/subcapitulo4_funcional.md \
  capitulo3/subcapitulo5_caso_cujae.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  recomendaciones/recomendaciones.md \
  referencias/referencias.md \
  anexos/anexo_a.md \
  -o "$OUT/tesis.pdf" \
  --pdf-engine=xelatex \
  --include-before-body=extras/portada.tex \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --number-sections \
  --syntax-highlighting=tango
```

> **Índices:** el `--toc` se eliminó a propósito. El índice general, el de figuras
> y el de tablas se colocan manualmente al final de `extras/simbolos.md` (norma
> CUJAE: el índice va después de declaración, agradecimientos, resumen y listas).

### PDF de un capítulo solo (revisión rápida)

Los drafts siempre van a `outputs/debug/` independientemente de `$OUT` (son borradores por definición).

```bash
# Capítulo 1
mkdir -p outputs/debug
pandoc \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_problema.md \
  capitulo1/subcapitulo2_sistemas_digitales.md \
  capitulo1/subcapitulo3_gemelo_digital.md \
  capitulo1/subcapitulo4_inteligencia_artificial.md \
  capitulo1/subcapitulo5_tecnologias.md \
  capitulo1/conclusion.md \
  -o outputs/debug/draft_capitulo1.pdf \
  --pdf-engine=xelatex \
  -H filters/draft-header.tex \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --number-sections \
  -V geometry:margin=2.5cm \
  -V fontsize=12pt \
  -V mainfont=Arial \
  -V lang=es

# Capítulo 2
mkdir -p outputs/debug
pandoc \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  -o outputs/debug/draft_capitulo2.pdf \
  --pdf-engine=xelatex \
  -H filters/draft-header.tex \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --number-sections \
  -V geometry:margin=2.5cm \
  -V fontsize=12pt \
  -V mainfont=Arial \
  -V lang=es

# Capítulo 3
mkdir -p outputs/debug
pandoc \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_estrategia.md \
  capitulo3/subcapitulo2_solar.md \
  capitulo3/subcapitulo3_cnn.md \
  capitulo3/subcapitulo4_funcional.md \
  capitulo3/subcapitulo5_caso_cujae.md \
  capitulo3/conclusion.md \
  -o outputs/debug/draft_capitulo3.pdf \
  --pdf-engine=xelatex \
  -H filters/draft-header.tex \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --number-sections \
  -V geometry:margin=2.5cm \
  -V fontsize=12pt \
  -V mainfont=Arial \
  -V lang=es
```

---

## Formatos Alternativos de Salida

### Word (.docx) — para revisión del tutor
Word no soporta `\include-before-body` LaTeX; la portada se omite y se entrega con plantilla institucional aparte.

```bash
mkdir -p "${OUT:-outputs/debug}"
pandoc \
  index.md \
  extras/declaracion_autoria.md \
  extras/agradecimientos.md \
  extras/resumen_es.md \
  extras/resumen_en.md \
  extras/acronimos.md \
  extras/simbolos.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_problema.md \
  capitulo1/subcapitulo2_sistemas_digitales.md \
  capitulo1/subcapitulo3_gemelo_digital.md \
  capitulo1/subcapitulo4_inteligencia_artificial.md \
  capitulo1/subcapitulo5_tecnologias.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_estrategia.md \
  capitulo3/subcapitulo2_solar.md \
  capitulo3/subcapitulo3_cnn.md \
  capitulo3/subcapitulo4_funcional.md \
  capitulo3/subcapitulo5_caso_cujae.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  recomendaciones/recomendaciones.md \
  referencias/referencias.md \
  anexos/anexo_a.md \
  -o "${OUT:-outputs/debug}/tesis_revision.docx" \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --toc \
  --number-sections
```

### LaTeX puro (.tex) — para inspección o ajuste manual

```bash
mkdir -p "${OUT:-outputs/debug}"
pandoc \
  index.md \
  extras/declaracion_autoria.md \
  extras/agradecimientos.md \
  extras/resumen_es.md \
  extras/resumen_en.md \
  extras/acronimos.md \
  extras/simbolos.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_problema.md \
  capitulo1/subcapitulo2_sistemas_digitales.md \
  capitulo1/subcapitulo3_gemelo_digital.md \
  capitulo1/subcapitulo4_inteligencia_artificial.md \
  capitulo1/subcapitulo5_tecnologias.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_estrategia.md \
  capitulo3/subcapitulo2_solar.md \
  capitulo3/subcapitulo3_cnn.md \
  capitulo3/subcapitulo4_funcional.md \
  capitulo3/subcapitulo5_caso_cujae.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  recomendaciones/recomendaciones.md \
  referencias/referencias.md \
  anexos/anexo_a.md \
  -o "${OUT:-outputs/debug}/tesis.tex" \
  --include-before-body=extras/portada.tex \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --toc \
  --number-sections \
  --standalone
```

### HTML — previsualización rápida en navegador

```bash
mkdir -p "${OUT:-outputs/debug}"
pandoc \
  index.md \
  extras/declaracion_autoria.md \
  extras/agradecimientos.md \
  extras/resumen_es.md \
  extras/resumen_en.md \
  extras/acronimos.md \
  extras/simbolos.md \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_problema.md \
  capitulo1/subcapitulo2_sistemas_digitales.md \
  capitulo1/subcapitulo3_gemelo_digital.md \
  capitulo1/subcapitulo4_inteligencia_artificial.md \
  capitulo1/subcapitulo5_tecnologias.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_estrategia.md \
  capitulo3/subcapitulo2_solar.md \
  capitulo3/subcapitulo3_cnn.md \
  capitulo3/subcapitulo4_funcional.md \
  capitulo3/subcapitulo5_caso_cujae.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  recomendaciones/recomendaciones.md \
  referencias/referencias.md \
  anexos/anexo_a.md \
  -o "${OUT:-outputs/debug}/tesis_preview.html" \
  --resource-path=.:recursos:recursos/figuras:recursos/capturas:recursos/validacion \
  --bibliography=referencias.bib \
  --citeproc \
  --lua-filter=filters/all-row-lines.lua \
  --toc \
  --number-sections \
  --standalone \
  --embed-resources
```

---

## Verificación de Referencias

### Listar todas las claves BibTeX usadas en los .md
```bash
grep -rh '@[a-zA-Z]' --include="*.md" . | grep -oE '[@{][a-zA-Z0-9_]+' | tr -d '@{' | sort -u
```

### Listar todas las claves definidas en referencias.bib
```bash
grep -oE '@[a-zA-Z]+\{[^,]+' referencias.bib | sed 's/.*{//' | sort -u
```

### Detectar referencias citadas pero no definidas en .bib
```bash
grep -rh '\[@' --include="*.md" . | grep -oE '@[a-zA-Z0-9_]+' | tr -d '@' | sort -u > /tmp/usadas.txt
grep -oE '@[a-zA-Z]+\{[^,]+' referencias.bib | sed 's/.*{//' | tr -d ' ' | sort -u > /tmp/definidas.txt
comm -23 /tmp/usadas.txt /tmp/definidas.txt
```

---

## Conteo de Palabras

### Conteo total del cuerpo (sin front/back matter)
```bash
pandoc \
  introduccion/introduccion.md \
  capitulo1/introduccion.md \
  capitulo1/subcapitulo1_problema.md \
  capitulo1/subcapitulo2_sistemas_digitales.md \
  capitulo1/subcapitulo3_gemelo_digital.md \
  capitulo1/subcapitulo4_inteligencia_artificial.md \
  capitulo1/subcapitulo5_tecnologias.md \
  capitulo1/conclusion.md \
  capitulo2/introduccion.md \
  capitulo2/subcapitulo1_arquitectura_sistema.md \
  capitulo2/subcapitulo2_implementacion.md \
  capitulo2/subcapitulo3_modelos_ml.md \
  capitulo2/conclusion.md \
  capitulo3/introduccion.md \
  capitulo3/subcapitulo1_estrategia.md \
  capitulo3/subcapitulo2_solar.md \
  capitulo3/subcapitulo3_cnn.md \
  capitulo3/subcapitulo4_funcional.md \
  capitulo3/subcapitulo5_caso_cujae.md \
  capitulo3/conclusion.md \
  conclusion/conclusion.md \
  recomendaciones/recomendaciones.md \
  --to=plain | wc -w
```

### Conteo por capítulo
```bash
echo "=== Introducción ===" && pandoc introduccion/introduccion.md --to=plain | wc -w
echo "=== Capítulo 1 ===" && pandoc capitulo1/*.md --to=plain | wc -w
echo "=== Capítulo 2 ===" && pandoc capitulo2/*.md --to=plain | wc -w
echo "=== Capítulo 3 ===" && pandoc capitulo3/*.md --to=plain | wc -w
echo "=== Conclusión ===" && pandoc conclusion/conclusion.md --to=plain | wc -w
echo "=== Recomendaciones ===" && pandoc recomendaciones/recomendaciones.md --to=plain | wc -w
```

---

## Limpieza de Archivos Generados

```bash
# Limpiar solo debug (lo más común durante el trabajo iterativo)
rm -rf outputs/debug/* && touch outputs/debug/.gitkeep

# Limpiar TODO (incluido lo de release — usar con cuidado)
rm -rf outputs/debug/* outputs/release/*
touch outputs/debug/.gitkeep outputs/release/.gitkeep
```

---

## Agregar un Nuevo Archivo `.md`

1. Crear el archivo en la carpeta correspondiente
2. Añadirlo en **TODOS** los comandos de este archivo (PDF principal, draft del capítulo si aplica, `.docx`, `.tex`, `.html`, y conteo de palabras)
3. Si modifica el orden canónico, actualizar la sección "Orden Canónico de Archivos" arriba
4. **No es necesario editar `index.md`** — solo contiene el YAML

---

## Notas Importantes

- **Motor PDF:** siempre `--pdf-engine=xelatex`. XeLaTeX soporta UTF-8 y fuentes del sistema (Times New Roman para tildes).
- **Portada:** se inyecta con `--include-before-body=extras/portada.tex`. Es LaTeX puro porque pandoc no genera el layout CUJAE.
- **Citas:** `--citeproc` reemplaza al viejo `--filter pandoc-citeproc` (pandoc 2.11+).
- **Orden importa:** pandoc concatena los `.md` en el orden recibido. El orden de los comandos aquí es el definitivo.
- **YAML solo en `index.md`:** los archivos de capítulos y de `extras/` no llevan bloque YAML.
- **Imágenes:** `--resource-path` permite usar rutas relativas a `recursos/figuras/`, `recursos/capturas/`, `recursos/validacion/` desde cualquier `.md`.
- **`.docx` omite la portada** porque Word no soporta `\include-before-body`. Para la versión Word entregar la portada como documento aparte usando la plantilla institucional.
- **Fuente:** si en el sistema no está "Times New Roman" instalada, pandoc fallará. Alternativa libre: cambiar `mainfont` en `index.md` a `"TeX Gyre Termes"`.
