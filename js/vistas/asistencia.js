// Asistencia: entradas, salidas y quién está adentro (Etapa 7). No muestra importes.
import { crear, rpc, traducirError, enLinea } from '../comun.js?v=9';
import { estadoSocio, hoyEn, fechaHora, plural } from '../formato.js?v=9';
import { campo, aviso, enviar, nuevaClave } from '../ui.js?v=9';

const ESPERA_MS = 350;
const hora = (iso, zona) => fechaHora(iso, zona).split(' ')[1] || '—';

export function vistaAsistencia(contenedor, ctx) {
  let activa = true;
  let pedido = 0;
  let temporizador = null;
  const esDueno = ctx.perfil.rol === 'dueno';
  const hoy = hoyEn(ctx.zona);
  let adentro = [];

  const entrada = crear('input', { id: 'buscar', type: 'search', placeholder: 'N.º de socio, DNI, apellido o nombre',
    autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search', maxlength: '60' });
  const estado = crear('div', { class: 'estado-busqueda', 'aria-live': 'polite' });
  const resultado = crear('div', { id: 'resultado-entrada', 'aria-live': 'polite' });
  const lista = crear('ul', { class: 'lista-socios', id: 'resultados' });
  const panel = crear('div', { class: 'panel-accion' });
  const zonaAdentro = crear('div', { id: 'zona-adentro', 'aria-live': 'polite' });

  contenedor.replaceChildren(
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Asistencia')),
    crear('div', { class: 'tarjeta' }, crear('label', { for: 'buscar' }, 'Buscar socio'), entrada),
    resultado, estado, lista, panel, zonaAdentro);

  const cerrarPanel = () => panel.replaceChildren();
  const abrirPanel = (titulo, cont) => { panel.replaceChildren(crear('h3', {}, titulo), cont); panel.scrollIntoView({ block: 'nearest' }); };
  const mostrar = (texto, tipo) => resultado.replaceChildren(aviso(texto, tipo));

  // ---------- Quién está adentro ----------
  async function cargarAdentro() {
    try {
      const r = await rpc('quien_esta_adentro');
      if (!activa) return;
      adentro = r.adentro || [];
      pintarAdentro();
    } catch (e) { if (activa) zonaAdentro.replaceChildren(aviso(traducirError(e))); }
  }

  async function salida(a) {
    resultado.replaceChildren();
    try {
      await rpc('registrar_salida', { p_asistencia_id: a.id });
      mostrar('Salida registrada: ' + a.apellido + ', ' + a.nombre + '.', 'ok');
      await cargarAdentro();
      await buscar(true);
    } catch (e) { mostrar(traducirError(e)); }
  }

  function formAnular(a) {
    const motivo = crear('textarea', { id: 'n-motivo', maxlength: '180', rows: '2', required: true });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      crear('p', {}, 'Se anula la entrada de ' + a.apellido + ', ' + a.nombre + '. Queda registrada con el motivo: no se borra.'),
      campo('Motivo', motivo), err,
      crear('div', { class: 'fila-botones' },
        crear('button', { type: 'submit', class: 'boton peligro' }, 'Anular entrada'),
        crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar')));
    enviar(f, err, async () => {
      await rpc('anular_asistencia', { p_asistencia_id: a.id, p_motivo: motivo.value });
      f.dataset.hecho = '1'; cerrarPanel();
      mostrar('Entrada anulada.', 'ok');
      await cargarAdentro(); await buscar(true);
    });
    return f;
  }

  async function cerrarViejas() {
    resultado.replaceChildren();
    try {
      const r = await rpc('cerrar_asistencias_abiertas');
      mostrar(r.cerradas === 1 ? 'Se cerró 1 entrada de un día anterior.' : 'Se cerraron ' + r.cerradas + ' entradas de días anteriores.', 'ok');
      await cargarAdentro();
    } catch (e) { mostrar(traducirError(e)); }
  }

  function pintarAdentro() {
    const viejas = adentro.filter((a) => a.de_dia_anterior).length;
    const cab = crear('div', { class: 'cabecera-vista' },
      crear('h3', { id: 'titulo-adentro' }, 'Adentro ahora (' + adentro.length + ')'),
      crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-actualizar', onclick: () => cargarAdentro() }, 'Actualizar'));
    const bloques = [cab];
    if (viejas) {
      bloques.push(crear('div', { class: 'aviso-caja atencion', id: 'aviso-viejas' },
        crear('p', {}, plural(viejas, 'entrada es', 'entradas son') + ' de un día anterior: nadie registró la salida.'),
        crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-cerrar-viejas', onclick: cerrarViejas }, 'Cerrar entradas de días anteriores')));
    }
    if (!adentro.length) bloques.push(crear('p', { class: 'suave', id: 'nadie-adentro' }, 'No hay nadie adentro.'));
    else {
      bloques.push(crear('ul', { class: 'lista-planes', id: 'lista-adentro' }, adentro.map((a) => {
        const etiquetas = [];
        if (a.en_tolerancia) etiquetas.push(crear('span', { class: 'pastilla atencion' }, 'Tolerancia'));
        else if (a.resultado === 'excepcion') etiquetas.push(crear('span', { class: 'pastilla atencion' }, 'Excepción'));
        if (a.de_dia_anterior) etiquetas.push(crear('span', { class: 'pastilla neutro' }, 'Día anterior'));
        const li = crear('li', { class: 'plan-item', 'data-asistencia': a.id },
          crear('div', { class: 'plan-info' },
            crear('strong', {}, a.apellido + ', ' + a.nombre),
            crear('span', { class: 'suave' }, 'N.º ' + a.numero + ' · entró a las ' + hora(a.entrada_en, ctx.zona) + (a.excepcion_motivo ? ' · ' + a.excepcion_motivo : ''))),
          crear('div', { class: 'etiquetas' }, ...etiquetas),
          crear('div', { class: 'fila-botones' },
            crear('button', { type: 'button', class: 'boton chico', 'data-salida': a.id, onclick: () => salida(a) }, 'Salida'),
            esDueno ? crear('button', { type: 'button', class: 'boton secundario chico peligro', 'data-anular': a.id,
              onclick: () => abrirPanel('Anular entrada', formAnular(a)) }, 'Anular') : null));
        return li;
      })));
    }
    zonaAdentro.replaceChildren(...bloques);
  }

  // ---------- Entrada ----------
  function formExcepcion(s) {
    const clave = nuevaClave();
    const motivo = crear('textarea', { id: 'x-motivo', maxlength: '200', rows: '2', required: true });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      crear('p', {}, 'Vas a dejar entrar a ' + s.apellido + ', ' + s.nombre + ' aunque no corresponda. Queda registrado como excepción con tu motivo.'),
      campo('Motivo', motivo), err,
      crear('div', { class: 'fila-botones' },
        crear('button', { type: 'submit', class: 'boton' }, 'Dejar entrar'),
        crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar')));
    enviar(f, err, async () => {
      const r = await rpc('registrar_entrada', { p_clave: clave, p_socio_id: s.socio_id, p_excepcion: true, p_motivo: motivo.value });
      f.dataset.hecho = '1'; cerrarPanel();
      await entroOk(s, r);
    });
    return f;
  }

  async function entroOk(s, r) {
    const nombre = s.apellido + ', ' + s.nombre;
    const partes = [];
    let tipo = 'ok';
    let texto = 'Entrada registrada: ' + nombre + '.';
    if (r.en_tolerancia) { tipo = 'atencion'; texto = 'Entró por tolerancia: ' + nombre + '. ' + r.excepcion_motivo + '. Queda registrado como excepción.'; }
    else if (r.resultado === 'excepcion') { tipo = 'atencion'; texto = 'Entrada por excepción: ' + nombre + '. Motivo: ' + r.excepcion_motivo + '.'; }
    partes.push(texto);
    if (r.aviso_tope) {
      tipo = 'atencion';
      partes.push('Ya vino todos los días que le da su plan esta semana' + (s.dias_por_semana ? ' (' + s.dias_por_semana + ')' : '') + '. Entró igual.');
    }
    mostrar(partes.join(' '), tipo);
    resultado.firstChild.id = 'resultado-' + tipo;
    entrada.value = ''; ctx.busqueda = ''; lista.replaceChildren(); estado.replaceChildren();
    await cargarAdentro();
    entrada.focus({ preventScroll: true });
  }

  const enCurso = new Set();
  async function entrar(s) {
    if (enCurso.has(s.socio_id)) return;
    enCurso.add(s.socio_id);
    resultado.replaceChildren(); cerrarPanel();
    try {
      const r = await rpc('registrar_entrada', { p_clave: nuevaClave(), p_socio_id: s.socio_id });
      await entroOk(s, r);
    } catch (e) {
      const m = traducirError(e);
      const caja = crear('div', {});
      const ya = /^Ya está adentro/.test(m);
      caja.append(aviso(m, ya ? 'atencion' : 'error'));
      caja.firstChild.id = ya ? 'resultado-ya-adentro' : 'resultado-rechazada';
      if (esDueno && /^No puede entrar:/.test(m) && !/dado de baja/.test(m)) {
        caja.append(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-excepcion', onclick: () => abrirPanel('Excepción del dueño', formExcepcion(s)) }, 'Dejar entrar con excepción'));
      }
      resultado.replaceChildren(caja);
    } finally { enCurso.delete(s.socio_id); }
  }

  // ---------- Búsqueda ----------
  function fila(s) {
    const est = estadoSocio(s, hoy);
    const aAdentro = adentro.find((a) => a.socio_id === s.socio_id);
    const vieja = !!(aAdentro && aAdentro.de_dia_anterior);
    const dentro = vieja ? null : aAdentro;
    return crear('li', { class: 'socio-item resultado-asistencia', 'data-socio': s.socio_id },
      crear('div', { class: 'socio-cab' },
        crear('span', { class: 'socio-nombre' }, s.apellido + ', ' + s.nombre,
          dentro ? crear('span', { class: 'etiqueta adentro' }, 'Adentro') : (vieja ? crear('span', { class: 'etiqueta' }, 'Entrada anterior sin salida') : null)),
        crear('span', { class: 'socio-sub' }, 'N.º ' + s.numero + (s.plan ? ' · ' + s.plan : '') + ' · DNI ' + s.dni),
        crear('span', { class: 'pastilla ' + est.clase }, est.texto),
        crear('span', { class: 'socio-detalle-corto' }, est.detalle)),
      crear('div', { class: 'fila-botones acciones-socio' },
        dentro
          ? crear('button', { type: 'button', class: 'boton chico', 'data-salida-socio': s.socio_id, onclick: () => salida(dentro) }, 'Salida')
          : crear('button', { type: 'button', class: 'boton chico', 'data-entrada': s.socio_id, onclick: () => entrar(s) }, 'Entrada')));
  }

  function mensaje(texto, error) { estado.replaceChildren(texto ? crear('p', { class: error ? 'error-texto' : 'suave' }, texto) : ''); }

  async function buscar(silencioso) {
    const t = entrada.value.trim();
    const mio = ++pedido;
    ctx.busqueda = t;
    if (!t) { lista.replaceChildren(); mensaje(''); return; }
    if (t.length < 2 && !/^[0-9]+$/.test(t)) { lista.replaceChildren(); mensaje('Escribí al menos 2 letras, o un número de socio o DNI.'); return; }
    if (!enLinea()) { mensaje('Sin conexión a internet. No se puede buscar hasta que vuelva.', true); return; }
    if (!silencioso) mensaje('Buscando…');
    try {
      const r = await rpc('buscar_socio', { p_texto: t });
      if (!activa || mio !== pedido) return;
      lista.replaceChildren(...r.socios.map(fila));
      if (!r.socios.length) mensaje('No se encontró ningún socio con «' + t + '».');
      else if (r.hay_mas) mensaje('Hay más de 10 coincidencias: mostramos las primeras 10. Escribí más datos para afinar.');
      else mensaje(r.socios.length === 1 ? '1 socio encontrado.' : r.socios.length + ' socios encontrados.');
    } catch (e) {
      if (!activa || mio !== pedido) return;
      lista.replaceChildren(); mensaje(traducirError(e), true);
    }
  }

  entrada.addEventListener('input', () => { resultado.replaceChildren(); clearTimeout(temporizador); temporizador = setTimeout(() => buscar(false), ESPERA_MS); });
  entrada.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); clearTimeout(temporizador); buscar(false); } });
  entrada.focus({ preventScroll: true });
  cargarAdentro();
  return () => { activa = false; clearTimeout(temporizador); };
}
