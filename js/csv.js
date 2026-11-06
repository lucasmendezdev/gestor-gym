// Exportar a CSV (Excel en español): separador ";", coma decimal, BOM UTF-8, fin de línea CRLF.
// Un texto que empieza con = + - @ se marca con apóstrofo para que Excel no lo tome como fórmula.
const PELIGRO = /^[=+\-@\t\r]/;

export function celda(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  let t = String(v);
  if (PELIGRO.test(t)) t = "'" + t;
  return /[;"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

// secciones: [{ titulo?, columnas: [..], filas: [[..], ..] }]
export function aCsv(secciones) {
  const lineas = [];
  secciones.forEach((s, i) => {
    if (i > 0) lineas.push('');
    if (s.titulo) lineas.push(celda(s.titulo));
    lineas.push(s.columnas.map(celda).join(';'));
    s.filas.forEach((f) => lineas.push(f.map(celda).join(';')));
  });
  return '﻿' + lineas.join('\r\n') + '\r\n';
}

export function descargarCsv(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
