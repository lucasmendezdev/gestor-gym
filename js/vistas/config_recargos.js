// Configuración · Recargos por mora (solo dueño). Se guardan todos los tramos juntos.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=11';
import { aviso, enviar, flash } from '../ui.js?v=11';

const MAX = 10; // el mismo máximo que la base
const num = (t) => Number(String(t).trim().replace(',', '.'));
const coma = (n) => String(Number(n)).replace('.', ',');

export function vistaRecargos(contenedor, ctx) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Recargos por mora')),
    crear('p', { class: 'suave' }, 'Al cobrar una cuota vencida se suma un recargo según los días de atraso: se usa el tramo más alto que ya se alcanzó. Sin tramos no hay recargo. El porcentaje no puede bajar a medida que suben los días. Hasta ' + MAX + ' tramos.'),
    mensajes, zona);
  flash(ctx, mensajes);

  function editor(tramos) {
    const filas = crear('div', { id: 'filas-tramos', class: 'filas-tramos' });
    const err = crear('div', { 'aria-live': 'polite' });
    const prueba = crear('input', { id: 'r-prueba', type: 'text', inputmode: 'numeric', maxlength: '3', placeholder: 'días' });
    const resPrueba = crear('span', { id: 'r-prueba-res', class: 'suave' });
    const agregar = crear('button', { type: 'button', class: 'boton secundario chico', id: 'r-agregar' }, 'Agregar tramo');
    const vacio = crear('p', { class: 'suave', id: 'r-vacio' }, 'Sin tramos: no se cobra recargo por mora.');

    const leer = () => [...filas.querySelectorAll('.fila-tramo')].map((f) => ({ d: f.querySelector('[data-d]').value, p: f.querySelector('[data-p]').value }));
    function probar() {
      const d = prueba.value.trim();
      if (!/^[0-9]{1,3}$/.test(d)) { resPrueba.textContent = ''; return; }
      let mejor = 0;
      leer().forEach((t) => { const dd = Number(t.d), pp = num(t.p); if (/^[0-9]+$/.test(t.d.trim()) && !Number.isNaN(pp) && dd <= Number(d) && pp > mejor) mejor = pp; });
      resPrueba.textContent = 'Con ' + d + (Number(d) === 1 ? ' día' : ' días') + ' de atraso: ' + (mejor ? coma(mejor) + ' % de recargo' : 'sin recargo');
    }
    function refrescar() { vacio.hidden = filas.children.length > 0; agregar.disabled = filas.children.length >= MAX; probar(); }
    function agregarFila(d, p) {
      const di = crear('input', { type: 'text', inputmode: 'numeric', maxlength: '3', 'data-d': '1', 'aria-label': 'Desde el día', value: d == null ? '' : String(d) });
      const pi = crear('input', { type: 'text', inputmode: 'decimal', maxlength: '6', 'data-p': '1', 'aria-label': 'Porcentaje de recargo', value: p == null ? '' : coma(p) });
      [di, pi].forEach((i) => i.addEventListener('input', () => { err.replaceChildren(); probar(); }));
      const f = crear('div', { class: 'fila-tramo' },
        crear('label', {}, 'Desde el día', di), crear('label', {}, 'Recargo %', pi),
        crear('button', { type: 'button', class: 'boton secundario chico peligro', 'data-quitar': '1', onclick: () => { f.remove(); err.replaceChildren(); refrescar(); } }, 'Quitar'));
      filas.append(f); refrescar();
    }
    tramos.forEach((t) => agregarFila(t.desde_dias, t.porcentaje));
    agregar.addEventListener('click', () => { agregarFila(null, null); filas.lastChild.querySelector('input').focus(); });
    prueba.addEventListener('input', probar);

    const f = crear('form', { class: 'formulario tarjeta', novalidate: true }, filas, vacio, crear('div', { class: 'fila-botones' }, agregar), err,
      crear('div', { class: 'campo' }, crear('label', { for: 'r-prueba' }, 'Probar: días de atraso'), prueba, resPrueba),
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', id: 'r-guardar' }, 'Guardar tramos')));
    enviar(f, err, async () => {
      const lista = leer().map((t) => {
        const d = t.d.trim(), p = num(t.p);
        if (!/^[0-9]{1,3}$/.test(d) || String(t.p).trim() === '' || Number.isNaN(p)) throw new Error('Completá con números los días y el porcentaje de cada tramo.');
        return { desde_dias: Number(d), porcentaje: p };
      });
      const r = await rpc('guardar_tramos_recargo', { p_tramos: lista });
      ctx.flash = r.length ? 'Tramos guardados.' : 'Tramos guardados: ya no se cobra recargo.';
      mensajes.replaceChildren(); flash(ctx, mensajes);
      filas.replaceChildren(); r.forEach((t) => agregarFila(t.desde_dias, t.porcentaje)); refrescar();
    });
    refrescar();
    return f;
  }

  (async () => {
    try {
      const { data, error } = await cliente().from('tramos_recargo').select('desde_dias, porcentaje').order('desde_dias');
      if (error) throw error;
      if (!activa) return;
      zona.replaceChildren(editor(data));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();
  return () => { activa = false; };
}
