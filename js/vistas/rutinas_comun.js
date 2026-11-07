// Rutinas · piezas compartidas: cómo se dibuja una rutina, su texto para WhatsApp y el panel para compartir.
import { crear } from '../comun.js?v=17';
import { fecha } from '../formato.js?v=17';
import { aviso } from '../ui.js?v=17';

export const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

export function totalEjercicios(dias) { return (dias || []).reduce((t, d) => t + d.ejercicios.length, 0); }
export function resumenDias(dias) { return plural(dias.length, 'día', 'días') + ' · ' + plural(totalEjercicios(dias), 'ejercicio', 'ejercicios'); }

export function textoDescanso(seg) {
  if (seg == null) return '';
  if (seg < 60) return seg + ' s';
  const m = Math.floor(seg / 60); const s = seg % 60;
  return m + ' min' + (s ? ' ' + s + ' s' : '');
}
export function lineaEjercicio(e) {
  return e.series + ' × ' + e.repeticiones + (e.descanso_seg != null ? ' · descanso ' + textoDescanso(e.descanso_seg) : '');
}

// Dibuja objetivo, notas y días con sus ejercicios (sirve para plantillas y asignaciones).
export function dibujarContenido(c) {
  return crear('div', { class: 'rutina-contenido', id: 'rutina-contenido' },
    c.objetivo ? crear('p', { class: 'rutina-objetivo' }, crear('strong', {}, 'Objetivo: '), c.objetivo) : null,
    c.notas ? crear('p', { class: 'rutina-notas' }, c.notas) : null,
    (c.dias || []).map((d, i) => crear('section', { class: 'rutina-dia', 'data-dia': String(i) },
      crear('h3', {}, d.nombre),
      crear('ol', { class: 'rutina-ejercicios' }, d.ejercicios.map((e) => crear('li', { class: 'rutina-ejercicio' },
        crear('strong', {}, e.nombre), crear('span', { class: 'rutina-detalle' }, lineaEjercicio(e)),
        e.nota ? crear('em', { class: 'rutina-nota' }, e.nota) : null))))));
}

// Texto plano pensado para WhatsApp (los asteriscos son negrita allá).
export function textoRutina({ gimnasio, socio, rutina, version, desde, nota, contenido }) {
  const l = [];
  if (gimnasio) l.push('*' + gimnasio + '*');
  l.push('Rutina' + (socio ? ' de ' + socio : '') + ': ' + rutina + (version ? ' (v' + version + ')' : ''));
  if (desde) l.push('Desde el ' + fecha(desde));
  if (contenido.objetivo) l.push('Objetivo: ' + contenido.objetivo);
  if (nota) l.push('Indicaciones: ' + nota);
  if (contenido.notas) l.push(contenido.notas);
  (contenido.dias || []).forEach((d) => {
    l.push('', '*' + d.nombre + '*');
    d.ejercicios.forEach((e, i) => l.push((i + 1) + '. ' + e.nombre + ' — ' + lineaEjercicio(e) + (e.nota ? ' (' + e.nota + ')' : '')));
  });
  return l.join('\n');
}

const soloDigitos = (t) => String(t || '').replace(/\D/g, '').replace(/^0+/, '');

// Panel para mandar la rutina: texto, botón de WhatsApp y copiar. No registra nada.
export function panelCompartir({ ctx, telefono, texto, cerrar }) {
  const numero = (ctx.prefijo || '549') + soloDigitos(telefono);
  const url = 'https://wa.me/' + numero + '?text=' + encodeURIComponent(texto);
  const valido = /^[0-9]{8,20}$/.test(numero) && url.length <= 7000;
  const area = crear('textarea', { id: 'rutina-texto', rows: '8', readonly: true, 'aria-label': 'Texto de la rutina' }); area.value = texto;
  const estado = crear('p', { class: 'ayuda suave', id: 'rutina-copiado', 'aria-live': 'polite' });
  const copiar = crear('button', { type: 'button', class: 'boton secundario', id: 'rutina-copiar', onclick: async () => {
    try { await navigator.clipboard.writeText(texto); estado.textContent = 'Texto copiado.'; }
    catch (_) { area.focus(); area.select(); estado.textContent = 'Seleccioná el texto y copialo.'; }
  } }, 'Copiar texto');
  return crear('div', { class: 'formulario', id: 'form-compartir' },
    valido ? null : aviso('No se puede abrir WhatsApp directo (teléfono inválido o rutina demasiado larga). Copiá el texto y pegalo en el chat.', 'atencion'),
    area, estado,
    crear('div', { class: 'fila-botones' },
      valido ? crear('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: 'boton enlace-boton', id: 'rutina-wa' }, 'Abrir WhatsApp') : null,
      copiar, crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cerrar')));
}

export function cabeceraImpresion(ctx, titulo) {
  return crear('div', { class: 'solo-impresion' }, crear('strong', {}, ctx.negocio || ''), crear('div', {}, titulo));
}
