const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /padding: '4%'/g,
  "padding: '4%', maxWidth: '100%'"
);

code = code.replace(
  /className="mb-2 object-contain"/g,
  "className=\"mb-2 object-contain shrink-0\""
);

const targetDivPre = `className="space-y-0.5 font-mono leading-tight whitespace-nowrap" style={{`;
code = code.replace(
  targetDivPre,
  `className="space-y-0.5 font-mono leading-tight" style={{`
);

let idx = code.indexOf(`className="space-y-0.5 font-mono leading-tight" style={{`);
if (idx > -1) {
  let endIdx = code.indexOf(`lineHeight: '1.4'\n`, idx);
  if (endIdx > -1) {
    code = code.substring(0, endIdx) + 
      "lineHeight: '1.4',\n" +
      "                       maxWidth: (selectedProject.logoImage && ((selectedProject.overlayPosition?.includes('top') && (selectedProject.logoPosition || 'top-left').includes('top') && selectedProject.overlayPosition !== (selectedProject.logoPosition || 'top-left')) || (selectedProject.overlayPosition?.includes('bottom') && (selectedProject.logoPosition || 'top-left').includes('bottom') && selectedProject.overlayPosition !== (selectedProject.logoPosition || 'top-left')))) ? `calc(100vw - 8vw - ${selectedProject.logoSize || 20}vw - 4vw)` : `calc(100vw - 8vw)`\n" +
      code.substring(endIdx + 18);
  }
}

code = code.replace(
  /<p>PROY: {selectedProject.name.toUpperCase\(\)}<\/p>/g,
  '<p className="line-clamp-4 break-words whitespace-pre-wrap">PROY: {selectedProject.name.toUpperCase()}</p>'
);
code = code.replace(
  /{selectedProject.showDate && <p>FECHA: {new Date\(\).toLocaleDateString\(\)}<\/p>}/g,
  '{selectedProject.showDate && <p className="line-clamp-4 break-words whitespace-pre-wrap">FECHA: {new Date().toLocaleDateString()}</p>}'
);
code = code.replace(
  /{selectedProject.showTime && <p>HORA: {new Date\(\).toLocaleTimeString\(\).split\(' '\)\[0\]}<\/p>}/g,
  '{selectedProject.showTime && <p className="line-clamp-4 break-words whitespace-pre-wrap">HORA: {new Date().toLocaleTimeString().split(\' \')[0]}</p>}'
);
code = code.replace(
  /{selectedProject.showTech && <p>TEC: {selectedProject.techName.toUpperCase\(\)}<\/p>}/g,
  '{selectedProject.showTech && <p className="line-clamp-4 break-words whitespace-pre-wrap">TEC: {selectedProject.techName.toUpperCase()}</p>}'
);

const oldFilter = `{selectedProject.customFields.filter(f => f.active !== false && f.showInPhoto && f.value.trim() !== '').map((f, i) => (
                          <p key={i}>{f.name.toUpperCase()}: {f.value.toUpperCase()}</p>
                        ))}`;

const newFilter = `{selectedProject.customFields.filter((f: any) => f.active !== false && f.showInPhoto && (f.name.trim() !== '' || f.value.trim() !== '')).map((f: any, i: number) => (
                          <p key={i} className="line-clamp-4 break-words whitespace-pre-wrap">
                            {f.value && f.value.trim() !== '' ? \`\${f.name.toUpperCase()}: \${f.value.toUpperCase()}\` : \`\${f.name.toUpperCase()}\`}
                          </p>
                        ))}`;

code = code.replace(oldFilter, newFilter);

code = code.replace(
  /<p className={gps \? 'text-green-400' : 'text-yellow-400 animate-pulse'}>/g,
  "<p className={`line-clamp-4 break-words whitespace-pre-wrap ${gps ? 'text-green-400' : 'text-yellow-400 animate-pulse'}`}>"
);

code = code.replace(
  /<p>UBI: {formattedLocation.toUpperCase\(\)}<\/p>/g,
  '<p className="line-clamp-4 break-words whitespace-pre-wrap">UBI: {formattedLocation.toUpperCase()}</p>'
);

fs.writeFileSync('src/App.tsx', code);
console.log('Update Script complete');
