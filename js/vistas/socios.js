// Sección Socios: búsqueda, alta y ficha.
import { crear, rpc, traducirError, enLinea } from '../comun.js?v=7';
import { estadoSocio, hoyEn } from '../formato.js?v=7';
import { esUuid } from '../ui.js?v=7';
import { vistaSocioNuevo } from './socio_nuevo.js?v=7';
import { vistaFicha } from './ficha.js?v=7';

const ESPERA_MS = 350;

function resultado(s, hoy, base) {
  const est = estadoSocio(s, hoy);
  return crear('li', { class: 'socio-item', 'data-socio': s.socio_id },
    crear('a', { class: 'socio-cab', href: base + s.socio_id },
      crear('span', { class: 'socio-nombre' }, s.apellido + ', ' + s.nombre,
        s.dentro ? crear('span', { class: 'etiqueta adentro' }, 'Adentro') : null),
      crear('span', { class: 'socio-sub' }, 'N.º ' + s.numero + (s.plan ? ' · ' + s.plan : '') + ' · DNI ' + s.dni),
      crear('span', { class: 'pastilla ' + est.clase }, est.texto),
      crear('span', { class: 'socio-detalle-corto' }, est.detalle)));
}

export function busqueda(contenedor, ctx, opts) {
  const o = Object.assign({ titulo: 'Socios', base: '#/socios/', conAlta: true }, opts || {});
  let activa = true;
  let pedido = 0;
  let temporizador = null;
  const hoy = hoyEn(ctx.zona);

  const entrada = crear('input', { id: 'buscar', type: 'search', placeholder: 'N.º de socio, DNI, apellido o nombre',
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search', maxlength: '60', 'aria-describedby': 'ayuda-buscar' });
  const ayuda = crear('p', { class: 'suave', id: 'ayuda-buscar' }, 'Escribí un número de socio, un DNI o al menos 2 letras del apellido o nombre.');
  const estado = crear('div', { class: 'estado-busqueda', 'aria-live': 'polite' });
  const lista = crear('ul', { class: 'lista-socios' });
  const nuevo = o.conAlta ? crear('a', { href: '#/socios/nuevo', class: 'boton chico enlace-boton', id: 'btn-nuevo-socio' }, 'Nuevo socio') : null;

  contenedor.replaceChildren(
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, o.titulo), nuevo),
    crear('div', { class: 'tarjeta' }, crear('label', { for: 'buscar' }, 'Buscar socio'), entrada, ayuda),
    estado, lista);

  function mensaje(texto, error, conAlta) {
    estado.replaceChildren(texto ? crear('p', { class: error ? 'error-texto' : 'suave' }, texto) : '',
      conAlta ? crear('a', { href: '#/socios/nuevo', class: 'enlace-simple', id: 'alta-desde-vacio' }, 'Dar de alta a un socio nuevo') : '');
  }

  async function buscar() {
    const t = entrada.value.trim();
    const mio = ++pedido;
    ctx.busqueda = t;
    if (!t) { lista.replaceChildren(); mensaje(''); return; }
    if (t.length < 2 && !/^[0-9]+$/.test(t)) { lista.replaceChildren(); mensaje('Escribí al menos 2 letras, o un número de socio o DNI.'); return; }
    if (!enLinea()) { mensaje('Sin conexión a internet. No se puede buscar hasta que vuelva.', true); return; }
    mensaje('Buscando…');
    try {
      const r = await rpc('buscar_socio', { p_texto: t });
      if (!activa || mio !== pedido) return;
      lista.replaceChildren(...r.socios.map((s) => resultado(s, hoy, o.base)));
      if (!r.socios.length) mensaje('No se encontró ningún socio con «' + t + '».', false, o.conAlta);
      else if (r.hay_mas) mensaje('Hay más de 10 coincidencias: mostramos las primeras 10. Escribí más datos para afinar.');
      else mensaje(r.socios.length === 1 ? '1 socio encontrado.' : r.socios.length + ' socios encontrados.');
    } catch (e) {
      if (!activa || mio !== pedido) return;
      lista.replaceChildren();
      mensaje(traducirError(e), true);
    }
  }

  entrada.addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(buscar, ESPERA_MS); });
  entrada.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(temporizador); buscar(); } });
  if (ctx.busqueda) { entrada.value = ctx.busqueda; buscar(); }
  entrada.focus({ preventScroll: true });
  return () => { activa = false; clearTimeout(temporizador); };
}

export function vistaSocios(contenedor, ctx, params) {
  const p = (params && params[0]) || '';
  if (p === 'nuevo') return vistaSocioNuevo(contenedor, ctx);
  if (esUuid(p)) return vistaFicha(contenedor, ctx, p);
  return busqueda(contenedor, ctx);
}
