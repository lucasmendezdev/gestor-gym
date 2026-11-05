// Sección Socios (Etapa 2): búsqueda de solo lectura.
import { crear, rpc, traducirError, enLinea } from '../comun.js';
import { estadoSocio, fecha, hoyEn } from '../formato.js';

const ESPERA_MS = 350;

function fila(etiqueta, valor) {
  return [crear('dt', {}, etiqueta), crear('dd', {}, valor)];
}

function detalle(s, est) {
  const filas = [
    ...fila('N.º de socio', String(s.numero)),
    ...fila('DNI', s.dni || '—'),
    ...fila('Teléfono', s.telefono || '—'),
  ];
  if (s.plan) filas.push(...fila('Plan', s.plan + (s.dias_por_semana ? ' (' + s.dias_por_semana + ' días por semana)' : '')));
  if (s.fecha_inicio) filas.push(...fila('Inicio de la membresía', fecha(s.fecha_inicio)));
  if (s.vence_el) filas.push(...fila('Vence el', fecha(s.vence_el)));
  if (s.estado === 'congelada') filas.push(...fila('Congelado hasta', fecha(s.congelada_hasta)));
  filas.push(...fila('En el gimnasio ahora', s.dentro ? 'Sí' : 'No'));
  return crear('dl', { class: 'detalle-socio' }, filas);
}

function resultado(s, hoy, n) {
  const est = estadoSocio(s, hoy);
  const idPanel = 'det-' + n;
  const panel = crear('div', { class: 'panel-detalle', id: idPanel, hidden: true }, detalle(s, est));
  const cab = crear('button', { type: 'button', class: 'socio-cab', 'aria-expanded': 'false', 'aria-controls': idPanel },
    crear('span', { class: 'socio-nombre' }, s.apellido + ', ' + s.nombre,
      s.dentro ? crear('span', { class: 'etiqueta adentro' }, 'Adentro') : null),
    crear('span', { class: 'socio-sub' }, 'N.º ' + s.numero + (s.plan ? ' · ' + s.plan : '')),
    crear('span', { class: 'pastilla ' + est.clase }, est.texto),
    crear('span', { class: 'socio-detalle-corto' }, est.detalle));
  cab.addEventListener('click', () => {
    const abrir = panel.hidden;
    panel.hidden = !abrir;
    cab.setAttribute('aria-expanded', String(abrir));
  });
  return crear('li', { class: 'socio-item', 'data-socio': s.socio_id }, cab, panel);
}

export function vistaSocios(contenedor, ctx) {
  let activa = true;
  let pedido = 0;
  let temporizador = null;
  const hoy = hoyEn(ctx.zona);

  const entrada = crear('input', { id: 'buscar', type: 'search', placeholder: 'N.º de socio, DNI, apellido o nombre',
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search', maxlength: '60', 'aria-describedby': 'ayuda-buscar' });
  const ayuda = crear('p', { class: 'suave', id: 'ayuda-buscar' }, 'Escribí un número de socio, un DNI o al menos 2 letras del apellido o nombre.');
  const estado = crear('div', { class: 'estado-busqueda', 'aria-live': 'polite' });
  const lista = crear('ul', { class: 'lista-socios' });

  contenedor.replaceChildren(
    crear('div', { class: 'tarjeta' }, crear('label', { for: 'buscar' }, 'Buscar socio'), entrada, ayuda),
    estado, lista);

  function mensaje(texto, error) {
    estado.replaceChildren(texto ? crear('p', { class: error ? 'error-texto' : 'suave' }, texto) : '');
  }

  async function buscar() {
    const t = entrada.value.trim();
    const mio = ++pedido;
    if (!t) { lista.replaceChildren(); mensaje(''); return; }
    if (t.length < 2 && !/^[0-9]+$/.test(t)) { lista.replaceChildren(); mensaje('Escribí al menos 2 letras, o un número de socio o DNI.'); return; }
    if (!enLinea()) { mensaje('Sin conexión a internet. No se puede buscar hasta que vuelva.', true); return; }
    mensaje('Buscando…');
    try {
      const r = await rpc('buscar_socio', { p_texto: t });
      if (!activa || mio !== pedido) return;
      lista.replaceChildren(...r.socios.map((s, i) => resultado(s, hoy, i)));
      if (!r.socios.length) mensaje('No se encontró ningún socio con «' + t + '».');
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
  entrada.focus({ preventScroll: true });
  return () => { activa = false; clearTimeout(temporizador); };
}
