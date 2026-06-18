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
  const headers = ['Timestamp', 'Producción (kW)', 'Consumo (kW)', 'Batería (%)', 'Export Red (kW)', 'Import Red (kW)', 'Eficiencia (%)'];
  const rows = readings.map(r => [
    fmtTs(r.timestamp),
    r.production.toFixed(2),
    r.consumption.toFixed(2),
    r.batteryLevel.toFixed(1),
    r.gridExport.toFixed(3),
    r.gridImport.toFixed(3),
    r.efficiency.toFixed(1),
  ]);
  const csv = buildCsv(headers, rows);
  downloadFile(csv, `${systemName.replace(/\s/g, '_')}_lecturas_${slugDate()}.csv`, 'text/csv;charset=utf-8;');
}

export function exportSummariesCsv(summaries: DailySummary[], systemName = 'Gemelo Digital') {
  const headers = [
    'Fecha', 'Producción Total (kWh)', 'Consumo Total (kWh)',
    'CO₂ Evitado (kg)', 'Batería Promedio (%)', 'Producción Máx (kW)',
    'Consumo Máx (kW)', 'Eficiencia Promedio (%)', 'Lecturas',
  ];
  const rows = summaries.map(s => [
    s.date,
    s.totalProduction.toFixed(2),
    s.totalConsumption.toFixed(2),
    (s.totalProduction * 0.5).toFixed(2),
    s.avgBatteryLevel.toFixed(1),
    s.maxProduction.toFixed(2),
    s.maxConsumption.toFixed(2),
    s.avgEfficiency.toFixed(1),
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

async function loadJsPdf() {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  return jsPDF;
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
) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;

  // ── Page 1: Cover + KPIs + chart bars ────────────────────────────────────
  drawPageHeader(doc, meta);

  // KPIs
  const totalProd = summaries.reduce((s, d) => s + d.totalProduction, 0);
  const totalCons = summaries.reduce((s, d) => s + d.totalConsumption, 0);
  const avgBat = summaries.length ? summaries.reduce((s, d) => s + d.avgBatteryLevel, 0) / summaries.length : 0;
  const co2 = totalProd * 0.5;
  const selfSufficiency = totalCons > 0 ? Math.min(100, (totalProd / totalCons) * 100) : 0;
  const avgEff = summaries.length ? summaries.reduce((s, d) => s + d.avgEfficiency, 0) / summaries.length : 0;

  const kpis: ReportKPI[] = [
    { label: 'Producción Total', value: `${totalProd.toFixed(1)} kWh` },
    { label: 'Consumo Total', value: `${totalCons.toFixed(1)} kWh` },
    { label: 'CO₂ Evitado', value: `${co2.toFixed(1)} kg` },
    { label: 'Bat. Promedio', value: `${avgBat.toFixed(1)}%` },
    { label: 'Autosuficiencia', value: `${selfSufficiency.toFixed(1)}%` },
    { label: 'Eficiencia Media', value: `${avgEff.toFixed(1)}%` },
    { label: 'Días analizados', value: String(summaries.length) },
    { label: 'Balance Energético', value: `${(totalProd - totalCons).toFixed(1)} kWh` },
  ];

  let y = 36;
  y = drawKpiCards(doc, kpis, y);
  y += 2;

  // Mini bar chart — production vs consumption per day
  if (summaries.length > 0) {
    y = drawSectionTitle(doc, 'Producción y Consumo Diario', y);
    const chartH = 40;
    const chartW = doc.internal.pageSize.getWidth() - 28;
    const barGroupW = Math.min(chartW / summaries.length, 10);
    const maxVal = Math.max(...summaries.map(s => Math.max(s.totalProduction, s.totalConsumption)), 1);

    // Axes
    doc.setDrawColor(...COLOR.border);
    doc.setLineWidth(0.2);
    doc.line(14, y, 14, y + chartH);
    doc.line(14, y + chartH, 14 + chartW, y + chartH);

    summaries.slice(0, Math.floor(chartW / barGroupW)).forEach((s, i) => {
      const bx = 14 + i * barGroupW;
      const prodH = (s.totalProduction / maxVal) * (chartH - 4);
      const consH = (s.totalConsumption / maxVal) * (chartH - 4);
      const bw = barGroupW * 0.35;

      doc.setFillColor(...COLOR.accent);
      doc.rect(bx + 0.5, y + chartH - prodH, bw, prodH, 'F');
      doc.setFillColor(...COLOR.blue);
      doc.rect(bx + bw + 1, y + chartH - consH, bw, consH, 'F');

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
    doc.setFillColor(...COLOR.blue);
    doc.rect(50, y + chartH + 7, 4, 3, 'F');
    doc.text('Consumo', 56, y + chartH + 9.5);

    y += chartH + 18;
  }

  // ── Page 2: Data table ────────────────────────────────────────────────────
  doc.addPage();
  drawPageHeader(doc, meta);
  y = 36;
  y = drawSectionTitle(doc, 'Resumen Diario Detallado', y);

  (doc as any).autoTable({
    startY: y,
    head: [[
      'Fecha', 'Producción\n(kWh)', 'Consumo\n(kWh)', 'CO₂ evitado\n(kg)',
      'Bat. media\n(%)', 'Prod. máx\n(kW)', 'Cons. máx\n(kW)', 'Eficiencia\n(%)', 'Lecturas',
    ]],
    body: summaries.map(s => [
      s.date,
      s.totalProduction.toFixed(2),
      s.totalConsumption.toFixed(2),
      (s.totalProduction * 0.5).toFixed(2),
      s.avgBatteryLevel.toFixed(1),
      s.maxProduction.toFixed(2),
      s.maxConsumption.toFixed(2),
      s.avgEfficiency.toFixed(1),
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
      2: { textColor: COLOR.blue },
      3: { textColor: COLOR.green },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      drawPageHeader(doc, meta);
    },
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
) {
  const JsPDF = await loadJsPdf();
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any;

  drawPageHeader(doc, meta);

  const kpis: ReportKPI[] = [
    { label: 'Total lecturas', value: String(readings.length) },
    {
      label: 'Prod. promedio',
      value: readings.length
        ? `${(readings.reduce((s, r) => s + r.production, 0) / readings.length).toFixed(2)} kW`
        : '—',
    },
    {
      label: 'Cons. promedio',
      value: readings.length
        ? `${(readings.reduce((s, r) => s + r.consumption, 0) / readings.length).toFixed(2)} kW`
        : '—',
    },
    {
      label: 'Bat. promedio',
      value: readings.length
        ? `${(readings.reduce((s, r) => s + r.batteryLevel, 0) / readings.length).toFixed(1)}%`
        : '—',
    },
  ];

  let y = 36;
  y = drawKpiCards(doc, kpis, y);
  y = drawSectionTitle(doc, 'Lecturas Horarias del Sistema', y);

  (doc as any).autoTable({
    startY: y,
    head: [['Timestamp', 'Producción (kW)', 'Consumo (kW)', 'Batería (%)', 'Export Red (kW)', 'Import Red (kW)', 'Eficiencia (%)']],
    body: readings.map(r => [
      fmtTs(r.timestamp),
      r.production.toFixed(2),
      r.consumption.toFixed(2),
      r.batteryLevel.toFixed(1),
      r.gridExport.toFixed(3),
      r.gridImport.toFixed(3),
      r.efficiency.toFixed(1),
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
      2: { textColor: COLOR.blue as unknown as string },
      3: { textColor: COLOR.purple as unknown as string },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      drawPageHeader(doc, meta);
    },
  });

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPageFooter(doc, p, total);
  }

  doc.save(`${meta.systemName.replace(/\s/g, '_')}_lecturas_${slugDate()}.pdf`);
}
