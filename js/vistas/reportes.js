// Reportes (Etapa 9B, solo dueño): ingresos, gastos, morosidad, asistencia, socios y cajas.
// Rutas: #/reportes (ingresos) · #/reportes/<pestaña>. El rango se recuerda mientras dura la sesión.
import { crear, rpc, traducirError, enLinea } from '../comun.js?v=11';
import { moneda, fecha, fechaHora, hoyEn, plural } from '../formato.js?v=11';
import { aviso } from '../ui.js?v=11';
import { aCsv, descargarCsv } from '../csv.js?v=11';

const MAX_DIAS = 366;
const dif = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
const sumar = (iso, n) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)).toISOString().slice(0, 10);
const esIso = (t) => /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t + 'T00:00:00Z'));
const nombreCompleto = (s) => s.apellido + ', ' + s.nombre;

// ---- piezas de pantalla ----
function datos(items) {
  return crear('div', { class: 'grilla-datos' }, items.map(([t, v, nota, clase, id]) =>
    crear('div', { class: 'dato ' + (clase || ''), 'data-dato': id || null }, crear('div', { class: 'dato-titulo' }, t), crear('div', { class: 'dato-valor' }, v), nota ? crear('div', { class: 'dato-nota' }, nota) : null)));
}
function tabla(id, columnas, filas, vacio) {
  if (!filas.length) return crear('p', { class: 'suave', id: id + '-vacio' }, vacio);
  return crear('div', { class: 'tabla-envoltorio' }, crear('table', { class: 'tabla-reporte', id },
    crear('thead', {}, crear('tr', {}, columnas.map((c) => crear('th', { class: c.num ? 'num' : '' }, c.t)))),
    crear('tbody', {}, filas.map((f) => crear('tr', {}, f.map((c, i) => crear('td', { class: columnas[i].num ? 'num' : '' }, c)))))));
}
function barras(id, items, vacio) {
  const max = Math.max(0, ...items.map((i) => i.valor));
  if (max === 0) return crear('p', { class: 'suave', id: id + '-vacio' }, vacio);
  return crear('div', { class: 'barras', id }, items.map((i) => {
    const relleno = crear('span', { class: 'barra-relleno' });
    relleno.style.width = Math.round((i.valor / max) * 100) + '%';
    return crear('div', { class: 'barra-fila', 'data-barra': i.clave }, crear('span', { class: 'barra-etiqueta' }, i.etiqueta), crear('span', { class: 'barra-caja' }, relleno), crear('span', { class: 'barra-valor' }, String(i.valor)));
  }));
}
const titulo = (t) => crear('h3', {}, t);
const recorte = (hayMas, n) => (hayMas ? aviso('Hay más resultados: se muestran solo los primeros ' + n + '. Achicá el rango de fechas para ver el resto.', 'atencion') : null);
const signo = (n) => (Number(n) > 0 ? 'bueno' : Number(n) < 0 ? 'alerta' : '');

// ---- cada reporte: pide, dibuja y arma su CSV ----
const REPORTES = {
  ingresos: {
    titulo: 'Ingresos', rpc: 'reporte_ingresos', rango: true,
    dibujar(d) {
      const t = d.totales;
      return {
        nodos: [datos([['Cuotas', moneda(t.cuotas), null, '', 'cuotas'], ['Otros ingresos', moneda(t.ingresos), null, '', 'ingresos'], ['Gastos', moneda(t.gastos), null, '', 'gastos'], ['Retiros', moneda(t.retiros), null, '', 'retiros'], ['Neto', moneda(t.neto), 'Cuotas + otros ingresos − gastos − retiros', signo(t.neto), 'neto']]),
          crear('p', { class: 'suave' }, 'Cifras ya netas de anulaciones.'),
          titulo('Por medio de pago'),
          tabla('t-medios', [{ t: 'Medio' }, { t: 'Cuotas', num: 1 }, { t: 'Otros', num: 1 }, { t: 'Gastos y retiros', num: 1 }, { t: 'Neto', num: 1 }],
            d.por_medio.map((m) => [m.medio + (m.es_efectivo ? ' (efectivo)' : ''), moneda(m.cuotas), moneda(m.ingresos), moneda(Number(m.gastos) + Number(m.retiros)), moneda(m.neto)]), 'No hubo movimientos en el período.'),
          titulo('Por día'),
          tabla('t-dias', [{ t: 'Día' }, { t: 'Cuotas', num: 1 }, { t: 'Otros', num: 1 }, { t: 'Gastos y retiros', num: 1 }, { t: 'Neto', num: 1 }],
            d.por_dia.map((x) => [fecha(x.fecha), moneda(x.cuotas), moneda(x.ingresos), moneda(Number(x.gastos) + Number(x.retiros)), moneda(x.neto)]), 'No hubo movimientos en el período.')],
        csv: [
          { titulo: 'Resumen', columnas: ['Cuotas', 'Otros ingresos', 'Gastos', 'Retiros', 'Neto'], filas: [[t.cuotas, t.ingresos, t.gastos, t.retiros, t.neto]] },
          { titulo: 'Por medio de pago', columnas: ['Medio', 'Efectivo', 'Cuotas', 'Otros ingresos', 'Gastos', 'Retiros', 'Neto'], filas: d.por_medio.map((m) => [m.medio, m.es_efectivo, m.cuotas, m.ingresos, m.gastos, m.retiros, m.neto]) },
          { titulo: 'Por día', columnas: ['Día', 'Cuotas', 'Otros ingresos', 'Gastos', 'Retiros', 'Neto'], filas: d.por_dia.map((x) => [fecha(x.fecha), x.cuotas, x.ingresos, x.gastos, x.retiros, x.neto]) }],
        vacio: d.por_dia.length === 0,
      };
    },
  },
  gastos: {
    titulo: 'Gastos', rpc: 'reporte_gastos', rango: true,
    dibujar(d) {
      return {
        nodos: [datos([['Total de gastos', moneda(d.total), plural(d.cantidad, 'gasto', 'gastos'), '', 'total']]),
          titulo('Por categoría'),
          tabla('t-categorias', [{ t: 'Categoría' }, { t: 'Gastos', num: 1 }, { t: 'Total', num: 1 }], d.por_categoria.map((c) => [c.categoria, String(c.cantidad), moneda(c.total)]), 'No hubo gastos en el período.'),
          titulo('Detalle'), recorte(d.hay_mas, d.detalle.length),
          tabla('t-detalle', [{ t: 'Día' }, { t: 'Gasto' }, { t: 'Monto', num: 1 }],
            d.detalle.map((g) => [fecha(g.fecha), [crear('strong', {}, g.categoria), crear('br'), g.descripcion || '', crear('br'), crear('span', { class: 'suave' }, 'Cargó ' + g.cargado_por)], moneda(g.monto)]), 'No hubo gastos en el período.')],
        csv: [
          { titulo: 'Por categoría', columnas: ['Categoría', 'Cantidad', 'Total'], filas: d.por_categoria.map((c) => [c.categoria, c.cantidad, c.total]) },
          { titulo: 'Detalle', columnas: ['Día', 'Categoría', 'Descripción', 'Cargado por', 'Monto'], filas: d.detalle.map((g) => [fecha(g.fecha), g.categoria, g.descripcion, g.cargado_por, g.monto]) }],
        vacio: d.cantidad === 0,
      };
    },
  },
  morosidad: {
    titulo: 'Morosidad', rpc: 'reporte_morosidad', rango: false,
    dibujar(d) {
      const filas = d.socios.map((s) => [
        [crear('a', { href: '#/socios/' + s.socio_id, class: 'enlace-simple' }, nombreCompleto(s)), crear('br'), crear('span', { class: 'suave' }, 'N.º ' + s.numero + ' · ' + s.plan),
          s.avisado_mora ? crear('span', { class: 'etiqueta' }, 'Avisado') : null, s.reemplazable ? crear('span', { class: 'etiqueta', 'data-reemplazable': '1' }, 'Reemplazable') : null],
        [fecha(s.vence_el), crear('br'), crear('span', { class: 'suave' }, plural(s.dias_atraso, 'día', 'días'))],
        moneda(s.precio_mensual)]);
      return {
        nodos: [datos([['Socios en mora', String(d.total_socios), 'A hoy, ' + fecha(d.fecha), d.total_socios ? 'alerta' : 'bueno', 'socios'], ['Deuda estimada', moneda(d.deuda_estimada), 'Un mes por socio, sin recargos', '', 'deuda']]),
          crear('p', { class: 'suave' }, '"Reemplazable": pasó el máximo de mora y su membresía puede reemplazarse al dar de alta una nueva.'),
          recorte(d.hay_mas, d.socios.length),
          tabla('t-mora', [{ t: 'Socio' }, { t: 'Venció' }, { t: 'Un mes', num: 1 }], filas, 'No hay socios en mora.')],
        csv: [{ titulo: 'Morosidad a ' + fecha(d.fecha), columnas: ['Apellido', 'Nombre', 'N.º', 'Teléfono', 'Plan', 'Venció', 'Días de atraso', 'Un mes de cuota', 'Avisado de mora', 'Reemplazable'],
          filas: d.socios.map((s) => [s.apellido, s.nombre, s.numero, s.telefono, s.plan, fecha(s.vence_el), s.dias_atraso, s.precio_mensual, s.avisado_mora, s.reemplazable]) }],
        vacio: d.total_socios === 0,
      };
    },
  },
  asistencia: {
    titulo: 'Asistencia', rpc: 'reporte_asistencia', rango: true,
    dibujar(d) {
      const t = d.totales;
      const horas = d.por_hora.filter((h) => h.entradas > 0);
      return {
        nodos: [datos([['Entradas', String(t.entradas), null, '', 'entradas'], ['Socios distintos', String(t.socios_distintos), null, '', 'distintos'], ['Excepciones', String(t.excepciones), t.excepciones ? t.excepciones_dueno + ' del dueño · ' + t.excepciones_tolerancia + ' por tolerancia' : null, t.excepciones ? 'atencion' : '', 'excepciones'], ['Avisos de tope', String(t.avisos_tope), null, '', 'tope'], ['Salidas automáticas', String(t.salidas_automaticas), 'Cerradas por el sistema', '', 'automaticas']]),
          titulo('Por día de la semana'),
          barras('b-semana', d.por_dia_semana.map((x) => ({ clave: x.dia_semana, etiqueta: x.nombre, valor: x.entradas })), 'No hubo entradas en el período.'),
          titulo('Por hora'),
          barras('b-hora', horas.map((x) => ({ clave: x.hora, etiqueta: String(x.hora).padStart(2, '0') + ':00', valor: x.entradas })), 'No hubo entradas en el período.'),
          titulo('Por día'),
          tabla('t-dias', [{ t: 'Día' }, { t: 'Entradas', num: 1 }, { t: 'Socios', num: 1 }], d.por_dia.map((x) => [fecha(x.fecha), String(x.entradas), String(x.socios)]), 'No hubo entradas en el período.')],
        csv: [
          { titulo: 'Resumen', columnas: ['Entradas', 'Socios distintos', 'Excepciones', 'Excepciones del dueño', 'Excepciones por tolerancia', 'Avisos de tope', 'Salidas automáticas'], filas: [[t.entradas, t.socios_distintos, t.excepciones, t.excepciones_dueno, t.excepciones_tolerancia, t.avisos_tope, t.salidas_automaticas]] },
          { titulo: 'Por día de la semana', columnas: ['Día', 'Entradas'], filas: d.por_dia_semana.map((x) => [x.nombre, x.entradas]) },
          { titulo: 'Por hora', columnas: ['Hora', 'Entradas'], filas: d.por_hora.map((x) => [String(x.hora).padStart(2, '0') + ':00', x.entradas]) },
          { titulo: 'Por día', columnas: ['Día', 'Entradas', 'Socios'], filas: d.por_dia.map((x) => [fecha(x.fecha), x.entradas, x.socios]) }],
        vacio: t.entradas === 0,
      };
    },
  },
  socios: {
    titulo: 'Socios', rpc: 'reporte_socios', rango: true,
    dibujar(d) {
      const t = d.totales;
      const mes = (m) => m.slice(5, 7) + '/' + m.slice(0, 4);
      return {
        nodos: [datos([['Altas', String(t.altas), 'En el período', '', 'altas'], ['Bajas', String(t.bajas), 'En el período', '', 'bajas'], ['Socios activos hoy', String(t.activos_hoy), null, '', 'activos']]),
          titulo('Altas y bajas por mes'),
          tabla('t-meses', [{ t: 'Mes' }, { t: 'Altas', num: 1 }, { t: 'Bajas', num: 1 }], d.por_mes.map((m) => [mes(m.mes), String(m.altas), String(m.bajas)]), 'Sin datos.'),
          titulo('Socios activos por plan'),
          tabla('t-planes', [{ t: 'Plan' }, { t: 'Socios', num: 1 }], d.por_plan.map((p) => [p.plan, String(p.socios)]), 'No hay socios activos.'),
          titulo('Inactivos (más de ' + d.dias_inactivo + ' días sin venir)'),
          crear('p', { class: 'suave', id: 'inactivos-cuenta' }, plural(d.inactivos_total, 'socio', 'socios') + ' con la cuota al día que no vienen.'), recorte(d.inactivos_hay_mas, d.inactivos.length),
          tabla('t-inactivos', [{ t: 'Socio' }, { t: 'Última vez' }],
            d.inactivos.map((s) => [[crear('a', { href: '#/socios/' + s.socio_id, class: 'enlace-simple' }, nombreCompleto(s)), crear('br'), crear('span', { class: 'suave' }, 'N.º ' + s.numero)],
              s.ultima_asistencia ? [fecha(s.ultima_asistencia), crear('br'), crear('span', { class: 'suave' }, 'hace ' + plural(s.dias_sin_asistir, 'día', 'días'))] : [crear('span', {}, 'Nunca vino'), crear('br'), crear('span', { class: 'suave' }, plural(s.dias_sin_asistir, 'día', 'días') + ' de socio')]]), 'Nadie está inactivo.')],
        csv: [
          { titulo: 'Resumen', columnas: ['Altas', 'Bajas', 'Socios activos hoy'], filas: [[t.altas, t.bajas, t.activos_hoy]] },
          { titulo: 'Por mes', columnas: ['Mes', 'Altas', 'Bajas'], filas: d.por_mes.map((m) => [mes(m.mes), m.altas, m.bajas]) },
          { titulo: 'Activos por plan', columnas: ['Plan', 'Socios'], filas: d.por_plan.map((p) => [p.plan, p.socios]) },
          { titulo: 'Inactivos (más de ' + d.dias_inactivo + ' días)', columnas: ['Apellido', 'Nombre', 'N.º', 'Teléfono', 'Última asistencia', 'Días sin asistir'], filas: d.inactivos.map((s) => [s.apellido, s.nombre, s.numero, s.telefono, s.ultima_asistencia ? fecha(s.ultima_asistencia) : 'Nunca', s.dias_sin_asistir]) }],
        vacio: false,
      };
    },
  },
  cajas: {
    titulo: 'Cajas', rpc: 'reporte_cajas', rango: true,
    dibujar(d, ctx) {
      const t = d.totales;
      const filas = d.cajas.map((c) => [
        [fechaHora(c.abierta_en, ctx.zona), crear('br'), crear('span', { class: 'suave' }, c.abierta ? 'Abierta · ' + c.abierta_por : c.abierta_por + (c.cerrada_por && c.cerrada_por !== c.abierta_por ? ' → ' + c.cerrada_por : '')), c.notas ? [crear('br'), crear('em', {}, c.notas)] : null],
        [moneda(c.monto_inicial), crear('br'), crear('span', { class: 'suave' }, 'esperado ' + moneda(c.monto_esperado))],
        c.abierta ? crear('span', { class: 'pastilla frio' }, 'Abierta') : [moneda(c.monto_contado), crear('br'), crear('span', { class: 'suave' + (Number(c.diferencia) !== 0 ? ' dif-alerta' : '') }, Number(c.diferencia) === 0 ? 'sin diferencia' : (Number(c.diferencia) > 0 ? 'sobran ' : 'faltan ') + moneda(Math.abs(c.diferencia)))]]);
      return {
        nodos: [datos([['Cajas', String(t.cajas), plural(t.cerradas, 'cerrada', 'cerradas') + (t.abiertas ? ' · ' + t.abiertas + ' abierta' + (t.abiertas > 1 ? 's' : '') : ''), '', 'cajas'], ['Con diferencia', String(t.con_diferencia), null, t.con_diferencia ? 'atencion' : 'bueno', 'con-dif'], ['Diferencia total', moneda(t.diferencia_total), 'Contado − esperado', signo(t.diferencia_total) === 'alerta' ? 'alerta' : '', 'dif-total']]),
          recorte(d.hay_mas, d.cajas.length),
          tabla('t-cajas', [{ t: 'Apertura' }, { t: 'Inicial' }, { t: 'Cierre', num: 1 }], filas, 'No hubo cajas en el período.')],
        csv: [{ titulo: 'Cajas', columnas: ['Apertura', 'Abrió', 'Cerró', 'Estado', 'Monto inicial', 'Esperado', 'Contado', 'Diferencia', 'Notas'],
          filas: d.cajas.map((c) => [fechaHora(c.abierta_en, ctx.zona), c.abierta_por, c.cerrada_por, c.abierta ? 'Abierta' : 'Cerrada', c.monto_inicial, c.monto_esperado, c.monto_contado, c.diferencia, c.notas]) }],
        vacio: d.cajas.length === 0,
      };
    },
  },
};
const ORDEN = ['ingresos', 'gastos', 'morosidad', 'asistencia', 'socios', 'cajas'];

export function vistaReportes(contenedor, ctx, params) {
  const id = REPORTES[params && params[0]] ? params[0] : 'ingresos';
  const rep = REPORTES[id];
  let activa = true, pedido = 0, csvActual = null, rangoPedido = null;
  const hoy = hoyEn(ctx.zona);
  if (!ctx.rango) ctx.rango = { desde: hoy.slice(0, 8) + '01', hasta: hoy };

  const desde = crear('input', { type: 'date', id: 'rep-desde', required: true, value: ctx.rango.desde });
  const hasta = crear('input', { type: 'date', id: 'rep-hasta', required: true, value: ctx.rango.hasta });
  const err = crear('div', { 'aria-live': 'polite', id: 'rep-error' });
  const zona = crear('div', { 'aria-live': 'polite', id: 'zona-reporte' });
  const botonCsv = crear('button', { type: 'button', class: 'boton secundario chico', id: 'rep-csv', disabled: true, onclick: bajar }, 'Descargar CSV');

  const poner = (d, h) => { desde.value = d; hasta.value = h; };
  const atajo = (texto, f) => crear('button', { type: 'button', class: 'boton secundario chico', 'data-atajo': texto, onclick: () => { const [d, h] = f(); poner(d, h); ver(); } }, texto);
  const mesPrimero = hoy.slice(0, 8) + '01';
  const mesPasadoFin = sumar(mesPrimero, -1);
  const form = crear('form', { class: 'formulario tarjeta filtro-reporte', novalidate: true, hidden: !rep.rango },
    crear('div', { class: 'fila-fechas' }, crear('label', {}, 'Desde', desde), crear('label', {}, 'Hasta', hasta)),
    crear('div', { class: 'fila-botones' }, atajo('Este mes', () => [mesPrimero, hoy]), atajo('Mes pasado', () => [mesPasadoFin.slice(0, 8) + '01', mesPasadoFin]), atajo('Últimos 30 días', () => [sumar(hoy, -29), hoy])),
    err, crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', id: 'rep-ver' }, 'Ver')));
  form.addEventListener('submit', (e) => { e.preventDefault(); ver(); });
  [desde, hasta].forEach((i) => i.addEventListener('input', () => err.replaceChildren()));

  contenedor.replaceChildren(
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Reportes'), botonCsv),
    crear('nav', { class: 'pestanas envuelve', 'aria-label': 'Reportes' }, ORDEN.map((k) => crear('a', { href: k === 'ingresos' ? '#/reportes' : '#/reportes/' + k, class: 'pestana' + (k === id ? ' activa' : ''), 'data-pestana': k, 'aria-current': k === id ? 'page' : null }, REPORTES[k].titulo))),
    form, zona);

  function validar() {
    if (!rep.rango) return null;
    const d = desde.value, h = hasta.value;
    if (!esIso(d) || !esIso(h)) return 'Indicá desde qué fecha y hasta qué fecha.';
    if (h < d) return 'La fecha final no puede ser anterior a la inicial.';
    if (dif(d, h) > MAX_DIAS - 1) return 'El rango no puede pasar de ' + MAX_DIAS + ' días.';
    return null;
  }

  async function ver() {
    err.replaceChildren();
    const m = validar();
    if (m) { err.replaceChildren(aviso(m)); return; }
    if (!enLinea()) { zona.replaceChildren(aviso('Sin conexión a internet. Cuando vuelva, tocá Ver.')); return; }
    if (rep.rango) ctx.rango = { desde: desde.value, hasta: hasta.value };
    rangoPedido = rep.rango ? { desde: desde.value, hasta: hasta.value } : null;
    const mio = ++pedido;
    botonCsv.disabled = true; csvActual = null;
    zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));
    try {
      const d = await rpc(rep.rpc, rep.rango ? { p_desde: rangoPedido.desde, p_hasta: rangoPedido.hasta } : {});
      if (!activa || mio !== pedido) return;
      const r = rep.dibujar(d, ctx);
      csvActual = r.csv;
      zona.replaceChildren(...[rep.rango ? crear('p', { class: 'suave', id: 'rep-rango' }, 'Del ' + fecha(d.desde) + ' al ' + fecha(d.hasta)) : null, ...r.nodos.flat()].filter(Boolean));
      botonCsv.disabled = false;
    } catch (e) { if (activa && mio === pedido) zona.replaceChildren(aviso(traducirError(e))); }
  }

  function bajar() {
    if (!csvActual) return;
    const sufijo = rangoPedido ? rangoPedido.desde + '_a_' + rangoPedido.hasta : hoy;
    descargarCsv('reporte-' + id + '_' + sufijo + '.csv', aCsv(csvActual));
  }

  ver();
  return () => { activa = false; };
}
