// Ficha del socio · tarjeta "Rutinas": la vigente, el historial y la asignación de una nueva.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=17';
import { fecha, hoyEn } from '../formato.js?v=17';
import { campo, aviso, enviar } from '../ui.js?v=17';
import { MOTIVOS } from './rutina_asignada.js?v=17';

export function bloqueRutinas({ ctx, id, baja, esDueno, abrirPanel, cerrarPanel, recargar }) {
  const zona = crear('div', { id: 'zona-rutinas-socio', 'aria-live': 'polite' });
  const boton = baja ? null : crear('button', { type: 'button', class: 'boton chico', id: 'btn-asignar-rutina', disabled: true, onclick: () => formAsignar() }, 'Asignar rutina');
  const tarjeta = crear('div', { class: 'tarjeta', id: 'tarjeta-rutinas' },
    crear('div', { class: 'cabecera-vista' }, crear('h3', {}, 'Rutinas'), boton), zona);
  let vigente = null;
  zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));

  const lineaFechas = (a) => 'Desde el ' + fecha(a.fecha_desde) + (a.fecha_hasta ? ' hasta el ' + fecha(a.fecha_hasta) : '');

  async function cargar() {
    try {
      const { data, error } = await cliente().from('asignaciones_rutina')
        .select('id, rutina_nombre, rutina_version, fecha_desde, fecha_hasta, estado, nota, finalizada_motivo, finalizada_nota')
        .eq('socio_id', id).order('fecha_desde', { ascending: false }).order('creada_en', { ascending: false });
      if (error) throw error;
      vigente = data.find((a) => a.estado === 'activa') || null;
      const previas = data.filter((a) => a.estado !== 'activa');
      if (boton) boton.disabled = false;
      zona.replaceChildren(
        vigente ? crear('div', { class: 'rutina-vigente', id: 'rutina-vigente', 'data-asignacion': vigente.id },
          crear('div', { class: 'plan-info' }, crear('strong', {}, vigente.rutina_nombre + ' (v' + vigente.rutina_version + ')'), crear('span', { class: 'suave' }, lineaFechas(vigente)),
            vigente.nota ? crear('span', { class: 'suave' }, vigente.nota) : null),
          crear('div', { class: 'fila-botones' },
            crear('a', { href: '#/rutinas/asignacion/' + vigente.id, class: 'boton secundario chico enlace-boton', id: 'btn-ver-rutina' }, 'Ver / imprimir / WhatsApp'),
            baja ? null : crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-finalizar-rutina', onclick: () => formFinalizar(vigente) }, 'Finalizar')))
          : crear('p', { class: 'suave', id: 'sin-rutina' }, 'No tiene una rutina vigente.'),
        previas.length ? crear('div', { id: 'historial-rutinas' }, crear('h4', {}, 'Historial'),
          crear('ul', { class: 'lista-historial' }, previas.map((a) => crear('li', { 'data-asignacion': a.id },
            crear('a', { href: '#/rutinas/asignacion/' + a.id }, a.rutina_nombre + ' (v' + a.rutina_version + ')'),
            crear('span', { class: 'suave' }, lineaFechas(a) + ' · ' + (MOTIVOS[a.finalizada_motivo] || '') + (a.finalizada_nota ? ': ' + a.finalizada_nota : '')))))) : null);
    } catch (e) { zona.replaceChildren(aviso(traducirError(e))); }
  }

  async function formAsignar() {
    const err = crear('div', { 'aria-live': 'polite' });
    const sel = crear('select', { id: 'as-rutina' }, crear('option', { value: '' }, 'Cargando…'));
    const desde = crear('input', { id: 'as-desde', type: 'date', value: hoyEn(ctx.zona) });
    const nota = crear('textarea', { id: 'as-nota', rows: '2', maxlength: '500' });
    const aviso1 = crear('div', { id: 'as-aviso' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      campo('Rutina', sel), campo('Empieza el', desde, 'Puede ser hasta 365 días atrás o 30 adelante.'), campo('Indicaciones para este socio (opcional)', nota),
      aviso1, err,
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', id: 'as-guardar' }, 'Asignar'), crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar')));
    abrirPanel('Asignar rutina', f);
    try {
      const { data, error } = await cliente().from('rutinas').select('id, nombre, version, activa').order('nombre');
      if (error) throw error;
      const act = data.filter((r) => r.activa);
      sel.replaceChildren(crear('option', { value: '' }, act.length ? 'Elegí una rutina…' : 'No hay rutinas activas'), ...act.map((r) => crear('option', { value: r.id }, r.nombre + ' (v' + r.version + ')')));
      if (!act.length) aviso1.replaceChildren(aviso(esDueno ? 'Todavía no hay rutinas activas. Creá una en la sección Rutinas.' : 'Todavía no hay rutinas activas. Pedile al dueño que cree una.', 'atencion'));
    } catch (e) { sel.replaceChildren(crear('option', { value: '' }, 'No se pudieron cargar')); err.replaceChildren(aviso(traducirError(e))); }
    if (vigente) aviso1.replaceChildren(aviso('Tiene vigente «' + vigente.rutina_nombre + '»: al asignar una nueva, esa pasa al historial.', 'atencion'));
    enviar(f, err, async () => {
      if (!sel.value) throw new Error('Elegí una rutina.');
      if (!desde.value) throw new Error('Elegí la fecha de inicio.');
      const args = { p_socio_id: id, p_rutina_id: sel.value, p_fecha_desde: desde.value };
      if (nota.value.trim()) args.p_nota = nota.value.trim();
      await rpc('asignar_rutina', args);
      ctx.flash = 'Rutina asignada.';
      await recargar();
    });
  }

  function formFinalizar(a) {
    const motivo = crear('textarea', { id: 'fin-motivo', rows: '2', maxlength: '300' });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      crear('p', {}, 'La rutina «' + a.rutina_nombre + '» pasa al historial. Se puede asignar otra cuando quieras.'),
      campo('Motivo (opcional)', motivo), err,
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', id: 'fin-confirmar' }, 'Finalizar rutina'), crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar')));
    abrirPanel('Finalizar rutina', f);
    enviar(f, err, async () => {
      const args = { p_asignacion_id: a.id };
      if (motivo.value.trim()) args.p_motivo = motivo.value.trim();
      await rpc('finalizar_rutina_socio', args);
      ctx.flash = 'Rutina finalizada.';
      await recargar();
    });
  }

  cargar();
  return tarjeta;
}
