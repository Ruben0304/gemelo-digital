-- ============================================================
-- all-row-lines.lua
-- ============================================================
-- Convierte cada tabla pandoc en un longtable LaTeX con:
--   - \hline entre todas las filas (no sólo arriba, debajo del
--     header y al final como hace booktabs por defecto)
--   - Doble línea bajo el header
--   - Columnas p{ancho} con \raggedright para que el texto se
--     ajuste haciendo wrap en lugar de desbordar el margen
--   - Preserva el formato del contenido de cada celda (negritas,
--     cursivas, citas, código, etc.)
-- ============================================================

local function render_blocks_latex(blocks)
  if blocks == nil or #blocks == 0 then return "" end
  local s = pandoc.write(pandoc.Pandoc(blocks), "latex")
  s = s:gsub("[%s]+$", "")
  return s
end

local function compute_widths(colspecs)
  local n = #colspecs
  local widths = {}
  local total_explicit = 0
  local default_count = 0

  for i, spec in ipairs(colspecs) do
    local w = spec[2]
    if type(w) == "number" and w > 0 then
      widths[i] = w
      total_explicit = total_explicit + w
    else
      widths[i] = false
      default_count = default_count + 1
    end
  end

  -- Reservar espacio para separadores y padding. El padding (\tabcolsep a
  -- ambos lados de cada columna) crece con el número de columnas, así que la
  -- reserva escala con n para que las tablas anchas no desborden el margen.
  local reserve = 0.04 + 0.025 * n
  if reserve > 0.6 then reserve = 0.6 end
  local available = (1.0 - reserve) - total_explicit
  if available < 0 then available = 0 end
  local default_w = (default_count > 0) and (available / default_count) or 0

  for i = 1, n do
    if widths[i] == false then widths[i] = default_w end
  end
  return widths
end

local function alignment_prefix(align)
  if align == "AlignRight" then return "\\raggedleft\\arraybackslash" end
  if align == "AlignCenter" then return "\\centering\\arraybackslash" end
  return "\\raggedright\\arraybackslash"
end

local function build_colspec(colspecs)
  local widths = compute_widths(colspecs)
  local parts = { "|" }
  for i, spec in ipairs(colspecs) do
    local align = spec[1]
    local w = string.format("%.4f", widths[i])
    table.insert(parts,
      ">{" .. alignment_prefix(align) .. "}p{" .. w .. "\\linewidth}")
    table.insert(parts, "|")
  end
  return table.concat(parts)
end

local function row_cells_latex(row, bold)
  local out = {}
  for _, cell in ipairs(row.cells) do
    local txt = render_blocks_latex(cell.contents)
    if bold then
      txt = "\\textbf{" .. txt .. "}"
    end
    table.insert(out, txt)
  end
  return table.concat(out, " & ")
end

function Table(tbl)
  local colspec = build_colspec(tbl.colspecs)

  local caption = ""
  if tbl.caption and tbl.caption.long and #tbl.caption.long > 0 then
    caption = render_blocks_latex(tbl.caption.long)
  end

  local label = ""
  if tbl.attr and tbl.attr.identifier and tbl.attr.identifier ~= "" then
    label = "\\label{" .. tbl.attr.identifier .. "}"
  end

  local headers = {}
  if tbl.head and tbl.head.rows then
    for _, row in ipairs(tbl.head.rows) do
      table.insert(headers, row_cells_latex(row, true))
    end
  end

  local bodies = {}
  for _, body in ipairs(tbl.bodies) do
    if body.body then
      for _, row in ipairs(body.body) do
        table.insert(bodies, row_cells_latex(row, false))
      end
    end
  end

  -- Tablas anchas (6+ columnas) en cuerpo más pequeño para que no desborden
  local wide = #tbl.colspecs >= 6
  local latex = ""
  if wide then latex = latex .. "{\\footnotesize\n" end
  latex = latex .. "\\begin{longtable}{" .. colspec .. "}\n"

  -- Leyenda ARRIBA (norma): el caption va al inicio de la tabla. El encabezado
  -- se declara en \endfirsthead y \endhead para que, si la tabla se fracciona
  -- entre páginas, el título de columnas se repita en cada página.
  if caption ~= "" then
    latex = latex .. "\\caption{" .. caption .. "}" .. label .. "\\\\\n"
  end

  latex = latex .. "\\hline\n"
  for _, h in ipairs(headers) do
    latex = latex .. h .. " \\\\ \\hline\\hline\n"
  end
  latex = latex .. "\\endfirsthead\n"

  latex = latex .. "\\hline\n"
  for _, h in ipairs(headers) do
    latex = latex .. h .. " \\\\ \\hline\\hline\n"
  end
  latex = latex .. "\\endhead\n"

  for _, r in ipairs(bodies) do
    latex = latex .. r .. " \\\\ \\hline\n"
  end

  latex = latex .. "\\end{longtable}\n"
  if wide then latex = latex .. "}\n" end

  return pandoc.RawBlock("latex", latex)
end
