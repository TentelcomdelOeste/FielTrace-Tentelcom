const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update Project Init in loadData
code = code.replace(/showDate: true,\s*showTime: true,/g, 'showDateTime: true,\n        dateTimeFormat: "format1",');
code = code.replace(/showObservations: true,/g, '');

// 2. Update init project state
code = code.replace(/showDate: true,\s*showTime: true,/g, 'showDateTime: true,\n      dateTimeFormat: "format1",');
code = code.replace(/showObservations: true,/g, '');

// 3. Helper to format DateTime
const dateTimeHelper = `
const formatDateTime = (format: 'format1' | 'format2') => {
  const now = new Date();
  if (format === 'format2') {
    return \`\${now.getDate()}/\${now.getMonth() + 1}/\${now.getFullYear()} \${now.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true })}\`;
  }
  return now.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};
`;
code = code.replace('// Inside App.tsx', '// Inside App.tsx' + dateTimeHelper);

// 4. Update Overlay Rendering
const oldDateTemplate = '{selectedProject.showDate && <p className="line-clamp-4 break-words whitespace-pre-wrap">FECHA: {new Date().toLocaleDateString()}</p>}\n                       {selectedProject.showTime && <p className="line-clamp-4 break-words whitespace-pre-wrap">HORA: {new Date().toLocaleTimeString().split(\' \')[0]}</p>}';
const newDateTemplate = '{selectedProject.showDateTime && <p className="line-clamp-4 break-words whitespace-pre-wrap">FECHA Y HORA: {formatDateTime(selectedProject.dateTimeFormat)}</p>}';

code = code.replace(new RegExp(oldDateTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newDateTemplate);

// 5. Update Setup View
code = code.replace(/<label className="text-\[10px\] font-black uppercase text-gray-500">Configuración de Overlay<\/label>/g, '<label className="text-[10px] font-black uppercase text-gray-500">Configuración de Overlay</label>\n{/* ADD NEW CONFIG UI HERE */}\n');

fs.writeFileSync('src/App.tsx', code);
console.log('Update App script complete');
