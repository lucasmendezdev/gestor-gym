// ui.js · piezas de formulario compartidas.
import { crear, traducirError, enLinea } from './comun.js?v=11';

export function campo(etiqueta, entrada, ayuda) {
  const id = entrada.id;
  return crear('div', { class: 'campo' },
    crear('label', { for: id }, etiqueta),
    entrada,
    ayuda ? crear('p', { class: 'ayuda suave', id: id + '-ayuda' }, ayuda) : null);
}

export function aviso(texto, tipo) {
  return crear('p', { class: 'aviso-caja ' + (tipo || 'error'), role: tipo === 'ok' ? 'status' : 'alert' }, texto);
}

// Envía un formulario: bloquea los botones, muestra el error en español y evita el doble toque.
export function enviar(form, zonaError, accion) {
  let enCurso = false;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (enCurso || form.dataset.hecho) return;
    zonaError.replaceChildren();
    if (!enLinea()) { zonaError.append(aviso('Sin conexión a internet. No se puede guardar hasta que vuelva.')); return; }
    enCurso = true;
    const botones = form.querySelectorAll('button');
    botones.forEach((b) => { b.disabled = true; });
    try { await accion(); } catch (e) { zonaError.replaceChildren(aviso(traducirError(e))); }
    finally { enCurso = false; if (!form.dataset.hecho) botones.forEach((b) => { b.disabled = false; }); }
  });
}

// Limpia un teléfono como lo hace la base: solo números y sin ceros al principio.
export function limpiarTelefono(t) { return String(t || '').replace(/\D/g, '').replace(/^0+/, ''); }

export function soloNumeros(t) { return String(t || '').replace(/\D/g, ''); }

export function flash(ctx, contenedor) {
  if (ctx.flash) { contenedor.append(aviso(ctx.flash, 'ok')); ctx.flash = null; }
}

export const esUuid = (t) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t || '');

// Clave única por operación (la base la usa para no duplicar si se repite el pedido).
export function nuevaClave() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  const b = new Uint8Array(16); window.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}
