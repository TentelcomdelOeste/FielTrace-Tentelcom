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
    
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Reporte de Evidencias: ${project?.name}`, 20, 20);
    
    doc.setFontSize(10);
    let y = 40;
    
    evidences.forEach((e, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(`${i+1}. Fecha: ${e.fecha} - Poste: ${e.baseFields.posteId}`, 20, y);
      y += 5;
      doc.text(`   Ubicación: ${e.ubicacion}`, 20, y);
      y += 10;
    });

    const fileName = `Reporte_${project?.name || 'Proyecto'}_${Date.now()}.pdf`;
    
    if (Capacitor.isNativePlatform()) {
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      await handleNativeExport(fileName, pdfBase64, 'string');
    } else {
      doc.save(fileName);
    }
  }
};
