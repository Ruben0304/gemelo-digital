/**
 * Report generation utilities — CSV and PDF exports.
 * PDF uses jsPDF + jspdf-autotable for professional layout.
 */

import type { HistoricalReading, DailySummary } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReportMeta {
  title: string;
  systemName: string;
  location: string;
  period: string;
  generatedAt: string;
}

export interface ReportKPI {
  label: string;
  value: string;
  unit?: string;
}

// Imagen rasterizada del gráfico en pantalla (PNG) para incrustar en el PDF.
export interface ChartImage {
  dataUrl: string;
  width: number;
  height: number;
}

// ─── CSV Utilities ────────────────────────────────────────────────────────────

function escapeCsv(val: unknown): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsv).join(','));
  return lines.join('\r\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  // BOM UTF-8 para que Excel (Windows) interprete bien los acentos y símbolos (CO₂, Batería…).
  const payload = mime.includes('csv') ? '﻿' + content : content;
  const blob = new Blob([payload], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtTs(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function slugDate(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// ─── CSV Exports ──────────────────────────────────────────────────────────────

export function exportReadingsCsv(readings: HistoricalReading[], systemName = 'Gemelo Digital') {
  const headers = ['Timestamp', 'Producción (kW)'];
  const rows = readings.map(r => [
    fmtTs(r.timestamp),
    r.productionKw.toFixed(2),
  ]);
  const csv = buildCsv(headers, rows);
  downloadFile(csv, `${systemName.replace(/\s/g, '_')}_lecturas_${slugDate()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportSummariesCsv(summaries: DailySummary[], systemName = 'Gemelo Digital') {
  const headers = [
    'Fecha', 'Producción Total (kWh)', 'CO₂ Evitado (kg)',
    'Producción Máx (kW)', 'Lecturas',
  ];
  const rows = summaries.map(s => [
    s.date,
    s.totalProductionKwh.toFixed(2),
    (s.totalProductionKwh * 0.5).toFixed(2),
    s.maxProductionKw.toFixed(2),
    s.readingCount,
  ]);
  const csv = buildCsv(headers, rows);
  downloadFile(csv, `${systemName.replace(/\s/g, '_')}_resumen_diario_${slugDate()}.csv`, 'text/csv;charset=utf-8;');
}

// ─── PDF Engine ───────────────────────────────────────────────────────────────

const COLOR = {
  primary:    [15, 118, 110] as [number, number, number],   // teal-700
  secondary:  [30, 41, 59]   as [number, number, number],   // slate-800
  accent:     [234, 179, 8]  as [number, number, number],   // yellow-500
  blue:       [37, 99, 235]  as [number, number, number],   // blue-600
  purple:     [124, 58, 237] as [number, number, number],   // violet-600
  green:      [22, 163, 74]  as [number, number, number],   // green-600
  muted:      [100, 116, 139] as [number, number, number],  // slate-500
  light:      [241, 245, 249] as [number, number, number],  // slate-100
  white:      [255, 255, 255] as [number, number, number],
  border:     [203, 213, 225] as [number, number, number],  // slate-300
};

// jspdf-autotable v5 expone una API FUNCIONAL: `autoTable(doc, opts)`. El antiguo
// `doc.autoTable(opts)` ya no se registra de forma fiable con el import de efecto
// secundario (y lanzaba silenciosamente), así que usamos la función directamente.
async function loadPdf() {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  return { jsPDF, autoTable };
}

// Coloca una imagen ajustada a (maxW, maxH) conservando proporción y centrada
// horizontalmente. Devuelve la Y inferior tras la imagen.
function addFittedImage(
  doc: any,
  img: ChartImage,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
): number {
  const aspect = img.width / img.height || 2;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const offsetX = x + (maxW - w) / 2;
  doc.addImage(img.dataUrl, 'PNG', offsetX, y, w, h);
  return y + h;
}

function drawPageHeader(doc: any, meta: ReportMeta) {
  const W = doc.internal.pageSize.getWidth();

  // Top colour band
  doc.setFillColor(...COLOR.primary);
  doc.rect(0, 0, W, 28, 'F');

  // Institution / system label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLOR.white);
  doc.text(meta.systemName, 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180, 230, 220);
  doc.text(meta.location, 14, 17);
  doc.text(`Generado: ${meta.generatedAt}`, 14, 22);

  // Report title block on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR.white);
  doc.text(meta.title, W - 14, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 240, 235);
  doc.text(meta.period, W - 14, 17, { align: 'right' });
}

function drawPageFooter(doc: any, pageNumber: number, totalPages: number) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  doc.setDrawColor(...COLOR.border);
  doc.setLineWidth(0.3);
  doc.line(14, H - 12, W - 14, H - 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR.muted);
  doc.text('Gemelo Digital Fotovoltaico — Universidad Tecnológica de La Habana (CUJAE)', 14, H - 7);
  doc.text(`Página ${pageNumber} de ${totalPages}`, W - 14, H - 7, { align: 'right' });
}

function drawKpiCards(doc: any, kpis: ReportKPI[], startY: number): number {
  const W = doc.internal.pageSize.getWidth();
  const usable = W - 28;
  const cols = Math.min(kpis.length, 4);
  const cardW = usable / cols;
  const cardH = 18;
  const cardColors: [number, number, number][] = [COLOR.primary, COLOR.blue, COLOR.green, COLOR.purple];

  kpis.slice(0, cols).forEach((kpi, i) => {
    const x = 14 + i * cardW;
    doc.setFillColor(...cardColors[i % cardColors.length]);
    doc.roundedRect(x, startY, cardW - 3, cardH, 2, 2, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLOR.white);
    doc.text(kpi.value, x + (cardW - 3) / 2, startY + 10, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 230, 255);
    doc.text(kpi.label.toUpperCase(), x + (cardW - 3) / 2, startY + 15, { align: 'center' });
  });

  // Second row if >4 kpis
  if (kpis.length > 4) {
    const row2Y = startY + cardH + 3;
    kpis.slice(4, 8).forEach((kpi, i) => {
      const x = 14 + i * cardW;
      doc.setFillColor(...COLOR.secondary);
      doc.roundedRect(x, row2Y, cardW - 3, cardH, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...COLOR.white);
      doc.text(kpi.value, x + (cardW - 3) / 2, row2Y + 10, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLOR.border);
      doc.text(kpi.label.toUpperCase(), x + (cardW - 3) / 2, row2Y + 15, { align: 'center' });
    });
    return row2Y + cardH + 6;
  }

  return startY + cardH + 6;
}

function drawSectionTitle(doc: any, title: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.primary);
  doc.text(title, 14, y);
  doc.setDrawColor(...COLOR.primary);
  doc.setLineWidth(0.5);
  doc.line(14, y + 1.5, 14 + doc.getTextWidth(title), y + 1.5);
  return y + 7;
}

// ─── PDF Exports ──────────────────────────────────────────────────────────────

export async function exportSummariesPdf(
  summaries: DailySummary[],
  meta: ReportMeta,
  chart?: ChartImage,
) {
  const { jsPDF: JsPDF, autoTable } = await loadPdf();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;

  // ── Page 1: Cover + KPIs + chart bars ────────────────────────────────────
  drawPageHeader(doc, meta);

  // KPIs
  const totalProd = summaries.reduce((s, d) => s + d.totalProductionKwh, 0);
  const maxProdKw = summaries.length ? Math.max(...summaries.map(d => d.maxProductionKw)) : 0;
  const co2 = totalProd * 0.5;

  const kpis: ReportKPI[] = [
    { label: 'Producción Total', value: `${totalProd.toFixed(1)} kWh` },
    { label: 'CO₂ Evitado', value: `${co2.toFixed(1)} kg` },
    { label: 'Máx. Producción', value: `${maxProdKw.toFixed(1)} kW` },
    { label: 'Días analizados', value: String(summaries.length) },
  ];

  let y = 36;
  y = drawKpiCards(doc, kpis, y);
  y += 2;

  // Gráfico: si llega la imagen real de la pantalla, se incrusta; si no, se
  // dibuja el mini gráfico de barras de respaldo.
  if (chart) {
    y = drawSectionTitle(doc, 'Producción solar diaria', y);
    const W = doc.internal.pageSize.getWidth();
    y = addFittedImage(doc, chart, 14, y, W - 28, 95);
    y += 6;
  } else if (summaries.length > 0) {
    y = drawSectionTitle(doc, 'Producción Solar Diaria', y);
    const chartH = 40;
    const chartW = doc.internal.pageSize.getWidth() - 28;
    const barGroupW = Math.min(chartW / summaries.length, 10);
    const maxVal = Math.max(...summaries.map(s => s.totalProductionKwh), 1);

    // Axes
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.2);
    doc.line(14, y, 14, y + chartH);
    doc.line(14, y + chartH, 14 + chartW, y + chartH);

    summaries.slice(0, Math.floor(chartW / barGroupW)).forEach((s, i) => {
      const bx = 14 + i * barGroupW;
      const prodH = (s.totalProductionKwh / maxVal) * (chartH - 4);
      const bw = barGroupW * 0.6;

      doc.setFillColor(...COLOR.accent);
      doc.rect(bx + 0.5, y + chartH - prodH, bw, prodH, 'F');

      // X label (date)
      if (i % Math.max(1, Math.floor(summaries.length / 10)) === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(...COLOR.muted);
        const label = s.date.slice(5); // MM-DD
        doc.text(label, bx + barGroupW / 2, y + chartH + 4, { align: 'center', angle: 45 });
      }
    });

    // Y-axis labels
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLOR.muted);
    doc.text('0', 10, y + chartH, { align: 'right' });
    doc.text(`${Math.round(maxVal / 2)}`, 10, y + chartH / 2, { align: 'right' });
    doc.text(`${Math.round(maxVal)}`, 10, y + 4, { align: 'right' });
    doc.text('kWh', 10, y - 1, { align: 'right' });

    // Legend
    doc.setFillColor(...COLOR.accent);
    doc.rect(14, y + chartH + 7, 4, 3, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR.secondary);
    doc.text('Producción', 20, y + chartH + 9.5);

    y += chartH + 18;
  }

  // ── Tabla de datos (debajo del gráfico; pagina sola si no cabe) ───────────
  y = drawSectionTitle(doc, 'Resumen diario detallado', y);

  autoTable(doc, {
    startY: y,
    head: [[
      'Fecha', 'Producción\n(kWh)', 'CO₂ evitado\n(kg)', 'Prod. máx\n(kW)', 'Lecturas',
    ]],
    body: summaries.map(s => [
      s.date,
      s.totalProductionKwh.toFixed(2),
      (s.totalProductionKwh * 0.5).toFixed(2),
      s.maxProductionKw.toFixed(2),
      s.readingCount,
    ]),
    headStyles: {
      fillColor: COLOR.primary,
      textColor: COLOR.white,
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
    alternateRowStyles: { fillColor: COLOR.light },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold' },
      2: { textColor: COLOR.green },
    },
    margin: { left: 14, right: 14, top: 32 },
    // En cada página nueva que cree la tabla, repintar la cabecera superior.
    didDrawPage: () => drawPageHeader(doc, meta),
  });

  // Finalize — add footers to all pages
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p, total);
  }

  doc.save(`${meta.systemName.replace(/\s/g, '_')}_reporte_diario_${slugDate()}.pdf`);
}

export async function exportReadingsPdf(
  readings: HistoricalReading[],
  meta: ReportMeta,
  chart?: ChartImage,
) {
  const { jsPDF: JsPDF, autoTable } = await loadPdf();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any;

  drawPageHeader(doc, meta);

  const kpis: ReportKPI[] = [
    { label: 'Total lecturas', value: String(readings.length) },
    {
      label: 'Prod. promedio',
      value: readings.length
        ? `${(readings.reduce((s, r) => s + r.productionKw, 0) / readings.length).toFixed(2)} kW`
        : '—',
    },
    {
      label: 'Prod. máxima',
      value: readings.length
        ? `${Math.max(...readings.map(r => r.productionKw)).toFixed(2)} kW`
        : '—',
    },
    {
      label: 'CO₂ evitado',
      value: readings.length
        ? `${(readings.reduce((s, r) => s + r.productionKw, 0) * (5 / 60) * 0.5).toFixed(1)} kg`
        : '—',
    },
  ];

  let y = 36;
  y = drawKpiCards(doc, kpis, y);

  // Gráfico de la serie (si se capturó de la pantalla).
  if (chart) {
    y = drawSectionTitle(doc, 'Producción por hora', y);
    const W = doc.internal.pageSize.getWidth();
    y = addFittedImage(doc, chart, 14, y, W - 28, 70);
    y += 6;
  }

  y = drawSectionTitle(doc, 'Lecturas horarias del sistema', y);

  autoTable(doc, {
    startY: y,
    head: [['Timestamp', 'Producción (kW)']],
    body: readings.map(r => [
      fmtTs(r.timestamp),
      r.productionKw.toFixed(2),
    ]),
    headStyles: {
      fillColor: COLOR.secondary,
      textColor: COLOR.white,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' },
    alternateRowStyles: { fillColor: COLOR.light },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 38 },
      1: { textColor: COLOR.accent as unknown as string },
    },
    margin: { left: 14, right: 14, top: 32 },
    didDrawPage: () => drawPageHeader(doc, meta),
  });

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p, total);
  }

  doc.save(`${meta.systemName.replace(/\s/g, '_')}_lecturas_${slugDate()}.pdf`);
}
