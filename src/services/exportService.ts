/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { storageService } from '../services/storageService';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

async function handleNativeExport(fileName: string, data: any, type: 'blob' | 'string' = 'blob') {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    let base64Data = data;
    if (type === 'blob') {
      const reader = new FileReader();
      base64Data = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(data);
      });
      base64Data = (base64Data as string).split(',')[1];
    }

    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true
    });

    await Share.share({
      title: fileName,
      url: uri,
      dialogTitle: 'Compartir reporte'
    });
    return true;
  } catch (e) {
    console.error('Export Native Error', e);
    return false;
  }
}

export const exportService = {
  async generateExcel(projectId: number) {
    const { utils, write } = await import('xlsx');
    const project = await storageService.getProject(projectId);
    const evidences = await storageService.getEvidencesByProject(projectId);
    
    const data = evidences.map(e => ({
      ID: e.id,
      Fecha: e.fecha,
      Hora: e.hora,
      Latitud: e.latitude,
      Longitud: e.longitude,
      Ubicacion: e.ubicacion,
      Poste: e.baseFields.posteId,
      Tecnico: e.baseFields.tecnico,
      ...Object.fromEntries(e.customFields.map(cf => [cf.name, cf.value]))
    }));

    const ws = utils.json_to_sheet(data);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Evidencias");
    
    const fileName = `Reporte_${project?.name || 'Proyecto'}_${Date.now()}.xlsx`;
    const excelBuffer = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    if (!(await handleNativeExport(fileName, blob))) {
      const { writeFile } = await import('xlsx');
      writeFile(wb, fileName);
    }
  },

  async generatePDF(projectId: number) {
    const { jsPDF } = await import('jspdf');
    const project = await storageService.getProject(projectId);
    const evidences = await storageService.getEvidencesByProject(projectId);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;

    const navy = [12, 67, 116] as const;
    const lightBlue = [226, 238, 248] as const;
    const grid = [180, 195, 210] as const;
    const text = [20, 34, 50] as const;
    const muted = [90, 105, 120] as const;

    const clean = (value: unknown) => {
      if (value === undefined || value === null || String(value).trim() === '' || String(value).toLowerCase() === 'undefined') return '—';
      return String(value);
    };

    const activeFields = Array.from(
      new Map(
        evidences
          .flatMap(e => (e.customFields || []).filter(f => f.active !== false))
          .map(f => [f.name, f])
      ).keys()
    );

    const headers = ['#', 'FECHA', 'HORA', 'TÉCNICO', 'UBICACIÓN / GPS', ...activeFields];

    const rows = evidences.map((e, index) => {
      const values = (e.customFields || []).filter(f => f.active !== false);
      const byName = new Map(values.map(f => [f.name, clean(f.value)]));
      const gps = (Number.isFinite(Number(e.latitude)) && Number.isFinite(Number(e.longitude)))
        ? `${Number(e.latitude).toFixed(6)}, ${Number(e.longitude).toFixed(6)}`
        : '—';
      return [
        String(index + 1),
        clean(e.fecha),
        clean(e.hora),
        clean(e.baseFields?.tecnico),
        `${clean(e.ubicacion)}\\n${gps}`,
        ...activeFields.map(name => byName.get(name) || '—')
      ];
    });

    const loadLogo = async (): Promise<string | null> => {
      try {
        const response = await fetch('/pwa-512x512.png');
        const blob = await response.blob();
        return await new Promise(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      } catch {
        return null;
      }
    };

    const logo = await loadLogo();

    const drawHeader = () => {
      if (logo) {
        try {
          doc.addImage(logo, 'PNG', margin, 8, 22, 22);
        } catch {
          doc.setFillColor(...navy);
          doc.roundedRect(margin, 8, 22, 22, 3, 3, 'F');
        }
      } else {
        doc.setFillColor(...navy);
        doc.roundedRect(margin, 8, 22, 22, 3, 3, 'F');
      }

      doc.setTextColor(...navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('FieldTrace', margin + 27, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      doc.text('Sistema de Registro de Evidencias', margin + 27, 23);

      doc.setDrawColor(...navy);
      doc.setLineWidth(0.45);
      doc.line(margin, 34, pageWidth - margin, 34);

      doc.setTextColor(...text);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.text('REPORTE DE EVIDENCIAS', margin, 45);

      doc.setFontSize(15);
      doc.text(clean(project?.name), margin, 53);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...text);
      doc.text('Fecha de generación:', pageWidth - 78, 44);
      doc.text('Total de registros:', pageWidth - 78, 50);
      doc.text('Generado por:', pageWidth - 78, 56);

      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleString('es-CR'), pageWidth - 48, 44);
      doc.text(String(evidences.length), pageWidth - 48, 50);
      const generator = clean(evidences[0]?.baseFields?.tecnico);
      doc.text(generator, pageWidth - 48, 56);
    };

    drawHeader();

    const baseWidths = [8, 20, 18, 29, 50];
    const dynamicWidths = activeFields.map(() => 20);
    const rawWidths = [...baseWidths, ...dynamicWidths];
    const rawTotal = rawWidths.reduce((sum, width) => sum + width, 0);
    const scale = Math.min(1, contentWidth / rawTotal);
    const widths = rawWidths.map(width => width * scale);
    const tableWidth = widths.reduce((sum, width) => sum + width, 0);

    const tableX = margin;
    let y = 61;
    const headerHeight = 11;
    const fontSize = Math.max(5.3, 7 * scale);

    const drawTableHeader = () => {
      let x = tableX;
      doc.setFillColor(...navy);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      headers.forEach((header, i) => {
        doc.setFillColor(...navy);
        doc.rect(x, y, widths[i], headerHeight, 'F');
        const lines = doc.splitTextToSize(header, Math.max(4, widths[i] - 2));
        const lineHeight = 3.1;
        const startY = y + (headerHeight - lines.length * lineHeight) / 2 + 2.5;
        doc.text(lines, x + widths[i] / 2, startY, { align: 'center' });
        x += widths[i];
      });
      doc.setDrawColor(...grid);
      doc.setLineWidth(0.25);
      x = tableX;
      widths.forEach(width => {
        doc.line(x, y, x, y + headerHeight);
        x += width;
      });
      doc.line(x, y, x, y + headerHeight);
      doc.line(tableX, y + headerHeight, tableX + tableWidth, y + headerHeight);
      y += headerHeight;
    };

    const drawTableRow = (row: string[], rowIndex: number) => {
      const cellLines = row.map((value, i) =>
        doc.splitTextToSize(clean(value), Math.max(4, widths[i] - 2))
      );
      const lineCount = Math.max(...cellLines.map(lines => lines.length));
      const lineHeight = 3.2;
      const rowHeight = Math.max(8, lineCount * lineHeight + 3);

      if (y + rowHeight > pageHeight - 17) {
        doc.addPage();
        y = 12;
        drawTableHeader();
      }

      let x = tableX;
      if (rowIndex % 2 === 0) {
        doc.setFillColor(247, 250, 253);
        doc.rect(tableX, y, tableWidth, rowHeight, 'F');
      }

      doc.setTextColor(...text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);

      row.forEach((_, i) => {
        const lines = cellLines[i];
        const lineHeightLocal = 3.2;
        const startY = y + (rowHeight - lines.length * lineHeightLocal) / 2 + 2.5;
        const align = i === 4 || i >= 5 ? 'left' : 'center';
        doc.text(lines, align === 'left' ? x + 1 : x + widths[i] / 2, startY, { align });
        x += widths[i];
      });

      doc.setDrawColor(...grid);
      doc.setLineWidth(0.22);
      x = tableX;
      widths.forEach(width => {
        doc.line(x, y, x, y + rowHeight);
        x += width;
      });
      doc.line(x, y, x, y + rowHeight);
      doc.line(tableX, y + rowHeight, tableX + tableWidth, y + rowHeight);
      y += rowHeight;
    };

    drawTableHeader();
    rows.forEach((row, index) => drawTableRow(row, index));

    const numericTotals = activeFields.map(name => {
      let total = 0;
      let count = 0;
      evidences.forEach(e => {
        const field = (e.customFields || []).find(f => f.active !== false && f.name === name);
        if (!field) return;
        const value = String(field.value ?? '').trim().replace(/,/g, '');
        if (/^-?\\d+(?:\\.\\d+)?$/.test(value)) {
          total += Number(value);
          count++;
        }
      });
      return { name, total, count };
    }).filter(item => item.count > 0);

    if (numericTotals.length > 0) {
      if (y + 25 > pageHeight - 12) {
        doc.addPage();
        y = 14;
      }
      y += 7;
      doc.setFillColor(...lightBlue);
      doc.rect(tableX, y, contentWidth, 9, 'F');
      doc.setTextColor(...navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('RESUMEN DE TOTALES (CAMPOS NUMÉRICOS)', tableX + 3, y + 6);
      y += 9;

      const summaryWidths = [contentWidth / numericTotals.length];
      const cellWidth = contentWidth / numericTotals.length;
      doc.setFontSize(7.5);
      numericTotals.forEach((item, i) => {
        const x = tableX + i * cellWidth;
        doc.setFillColor(247, 250, 253);
        doc.rect(x, y, cellWidth, 8, 'F');
        doc.setDrawColor(...grid);
        doc.rect(x, y, cellWidth, 8);
        doc.setTextColor(...text);
        doc.text(item.name, x + cellWidth / 2, y + 3.5, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.total), x + cellWidth / 2, y + 6.8, { align: 'center' });
        doc.setFont('helvetica', 'normal');
      });
      y += 8;
    }

    if (y + 17 > pageHeight - 8) {
      doc.addPage();
      y = 14;
    }
    y += 6;
    doc.setFillColor(242, 246, 250);
    doc.rect(tableX, y, contentWidth, 14, 'F');
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Observaciones:', tableX + 3, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...text);
    doc.text('Reporte generado automáticamente desde FieldTrace. Los totales corresponden únicamente a campos numéricos.', tableX + 3, y + 10);

    const footerY = pageHeight - 8;
    doc.setDrawColor(...navy);
    doc.setLineWidth(0.4);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TENTELCOM DEL OESTE S.A.', margin, footerY);
    doc.setFont('helvetica', 'normal');
    doc.text('Alajuela, Costa Rica', margin, footerY + 4);
    doc.text(`Fecha de impresión: ${new Date().toLocaleString('es-CR')}`, pageWidth - margin, footerY, { align: 'right' });

    const fileName = `Reporte_${project?.name || 'Proyecto'}_${Date.now()}.pdf`;

    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      await handleNativeExport(fileName, pdfBase64, 'string');
    } else {
      doc.save(fileName);
    }
  }
};
