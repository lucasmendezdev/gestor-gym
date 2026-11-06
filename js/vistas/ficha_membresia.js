// Membresía y congelamientos dentro de la ficha del socio (Etapa 3B).
// Recepción: crea la membresía con un plan y ve el estado. Dueño: además edita, cierra y congela.
import { crear, cliente, rpc } from '../comun.js?v=10';
import { fecha, moneda, hoyEn } from '../formato.js?v=10';
import { campo, enviar, nuevaClave } from '../ui.js?v=10';

// Texto del precio: "15000,5" / "15.000,50" -> número (o null si está vacío; NaN si es inválido).
export function leerMonto(t) {
  const x = String(t || '').trim();
  if (!x) return null;
  const n = Number(x.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

const num = (v) => (v == null ? null : Number(v));

// Datos que solo lee el dueño (la base no deja leer estas tablas a recepción).
export async function cargarExtra(membresiaId, socioId) {
  const { data: m, error: e1 } = await cliente().from('membresias')
    .select('id, plan_id, fecha_inicio, precio_mensual, dias_por_semana, descuento_id, descuento_pct, estado')
    .eq('id', membresiaId).maybeSingle();
  if (e1) throw e1;
  const { data: cong, error: e2 } = await cliente().from('congelamientos')
    .select('id, desde, hasta, dias, motivo, anulado_en, anulado_motivo')
    .eq('membresia_id', membresiaId).order('desde', { ascending: false });
  if (e2) throw e2;
  const { data: cobros, error: e3 } = await cliente().from('cobros')
    .select('id, recibo, membresia_id, desde, hasta, meses, monto_total, anulado_en, anulado_motivo, creado_en')
    .eq('socio_id', socioId).order('recibo', { ascending: false });
  if (e3) throw e3;
  return { m, cong: cong || [], cobros: cobros || [] };
}

async function cargarPlanes() {
  const { data, error } = await cliente().from('planes')
    .select('id, nombre, dias_por_semana, precio_mensual, personalizado, activo').order('nombre');
  if (error) throw error;
  return data || [];
}

async function cargarDescuentos() {
  const { data, error } = await cliente().from('descuentos')
    .select('id, nombre, porcentaje, activo').order('nombre');
  if (error) throw error;
  return (data || []).filter((d) => d.activo);
}

const textoPlan = (p) => p.nombre + (p.personalizado ? ' (personalizado)'
  : ' · ' + (p.dias_por_semana ? p.dias_por_semana + ' días' : 'sin tope'));

function selectDias(id, primera) {
  const s = crear('select', { id });
  s.append(crear('option', { value: '' }, primera), crear('option', { value: '0' }, 'Sin tope semanal'));
  for (let i = 1; i <= 7; i++) s.append(crear('option', { value: String(i) }, i + (i === 1 ? ' día por semana' : ' días por semana')));
  return s;
}

function estadoCong(g, hoy) {
  if (g.anulado_en) return { texto: 'Anulado', clase: 'neutro' };
  if (hoy < g.desde) return { texto: 'Programado', clase: 'frio' };
  if (hoy <= g.hasta) return { texto: 'En curso', clase: 'frio' };
  return { texto: 'Terminado', clase: 'neutro' };
}

/**
 * Devuelve { tarjeta, botones }: la tarjeta de membresía y los botones de acción que van debajo.
 * h = { ctx, id, est, extra, esDueno, abrirPanel, cerrarPanel, formConfirmar, recargar }
 */
export function bloqueMembresia(h) {
  const { ctx, id, est, extra, esDueno } = h;
  const hoy = hoyEn(ctx.zona);
  const botones = [];
  const lista = crear('dl', { class: 'detalle-socio' });
  const fila = (et, v) => lista.append(crear('dt', {}, et), crear('dd', {}, v));
  const tiene = est.estado !== 'sin_membresia';

  if (!tiene) {
    fila('Membresía', 'No tiene una membresía activa');
  } else {
    fila('Plan', est.plan + (est.dias_por_semana ? ' (' + est.dias_por_semana + ' días por semana)' : ' (sin tope semanal)'));
    fila('Inicio', fecha(est.fecha_inicio));
    fila('Vence el', est.tiene_cobros === false ? 'Sin cobros todavía' : fecha(est.vence_el));
    if (est.estado === 'congelada') fila('Congelado hasta', fecha(est.congelada_hasta));
    if (esDueno && extra && extra.m) {
      fila('Precio pactado', moneda(extra.m.precio_mensual) + ' por mes');
      if (num(extra.m.descuento_pct) > 0) fila('Descuento', num(extra.m.descuento_pct) + ' %');
    }
  }

  const tarjeta = crear('div', { class: 'tarjeta', id: 'tarjeta-membresia' }, crear('h3', {}, 'Membresía'), lista);
  if (tiene && est.tiene_cobros === false) {
    tarjeta.append(crear('p', { class: 'suave', id: 'nota-primer-cobro' },
      'La membresía ya está creada. El cobro de la primera cuota se hace desde la sección Cobrar (próxima etapa).'));
  }

  // ---- Historial de congelamientos (solo dueño) ----
  if (esDueno && tiene && extra) {
    const caja = crear('div', { id: 'congelamientos' }, crear('h3', {}, 'Congelamientos'));
    if (!extra.cong.length) caja.append(crear('p', { class: 'suave' }, 'Todavía no tiene congelamientos.'));
    extra.cong.forEach((g) => {
      const e = estadoCong(g, hoy);
      const item = crear('div', { class: 'cong-item', 'data-cong': g.id },
        crear('div', {},
          crear('strong', {}, fecha(g.desde) + ' al ' + fecha(g.hasta)),
          crear('span', { class: 'suave' }, ' · ' + g.dias + (g.dias === 1 ? ' día' : ' días')),
          crear('p', { class: 'suave' }, g.motivo + (g.anulado_en ? ' · Anulado: ' + (g.anulado_motivo || '') : ''))),
        crear('span', { class: 'pastilla ' + e.clase }, e.texto));
      if (e.texto === 'Programado') {
        item.append(crear('button', { type: 'button', class: 'boton secundario chico', 'data-anular': g.id, onclick: () => h.abrirPanel('Anular congelamiento',
          h.formConfirmar({ boton: 'Anular congelamiento', motivo: true,
            texto: 'El congelamiento del ' + fecha(g.desde) + ' al ' + fecha(g.hasta) + ' no se aplica y el vencimiento vuelve a como estaba.',
            accion: (m) => rpc('anular_congelamiento', { p_id: g.id, p_motivo: m }), mensaje: 'Congelamiento anulado.' })) }, 'Anular'));
      } else if (e.texto === 'En curso') {
        item.append(crear('button', { type: 'button', class: 'boton secundario chico', 'data-terminar': g.id, onclick: () => h.abrirPanel('Terminar congelamiento',
          h.formConfirmar({ boton: 'Terminar congelamiento',
            texto: 'El socio vuelve a entrenar desde hoy. Los días que no use se descuentan del vencimiento.',
            accion: () => rpc('terminar_congelamiento', { p_id: g.id }), mensaje: 'Congelamiento terminado.' })) }, 'Terminar ahora'));
      }
      caja.append(item);
    });
    tarjeta.append(caja);

    // ---- Historial de cobros (solo dueño) ----
    const cb = crear('div', { id: 'historial-cobros' }, crear('h3', {}, 'Cobros'));
    if (!extra.cobros.length) cb.append(crear('p', { class: 'suave' }, 'Todavía no tiene cobros.'));
    const ultimo = extra.cobros.find((c) => !c.anulado_en && c.membresia_id === (extra.m && extra.m.id));
    extra.cobros.forEach((c) => {
      const item = crear('div', { class: 'cong-item', 'data-cobro': c.id },
        crear('div', {},
          crear('strong', {}, 'Recibo ' + String(c.recibo).padStart(6, '0') + ' · ' + moneda(c.monto_total)),
          crear('p', { class: 'suave' }, fecha(c.desde) + ' al ' + fecha(c.hasta) + ' · ' + (c.meses === 1 ? '1 mes' : c.meses + ' meses') +
            (c.anulado_en ? ' · Anulado: ' + (c.anulado_motivo || '') : ''))),
        crear('span', { class: 'pastilla ' + (c.anulado_en ? 'neutro' : 'ok') }, c.anulado_en ? 'Anulado' : 'Vigente'),
        crear('div', { class: 'fila-botones' },
          crear('a', { href: '#/cobrar/' + id + '/recibo/' + c.id, class: 'boton secundario chico enlace-boton', 'data-recibo': c.id }, 'Ver recibo'),
          ultimo && ultimo.id === c.id ? crear('button', { type: 'button', class: 'boton secundario chico peligro', 'data-anular-cobro': c.id, onclick: () => {
            const claveAnular = nuevaClave();
            h.abrirPanel('Anular cobro', h.formConfirmar({ boton: 'Anular cobro', claseBoton: 'peligro', motivo: true,
              texto: 'Se anula el último cobro (' + moneda(c.monto_total) + '). El vencimiento vuelve atrás y la plata se devuelve en la caja. Si fue en efectivo hace falta una caja abierta.',
              accion: (m) => rpc('anular_cobro', { p_clave: claveAnular, p_cobro_id: c.id, p_motivo: m }), mensaje: 'Cobro anulado.' }));
          } }, 'Anular') : null));
      cb.append(item);
    });
    tarjeta.append(cb);
  }

  // ---- Botones ----
  if (tiene) botones.push(crear('a', { href: '#/cobrar/' + id, class: 'boton chico enlace-boton', id: 'btn-cobrar-ficha' }, 'Cobrar'));
  const puedeCrear = est.estado === 'sin_membresia' || (est.estado === 'vencida' && est.dias_atraso > 60);
  if (puedeCrear) {
    botones.push(crear('button', { type: 'button', class: 'boton chico', id: 'btn-nueva-mem',
      onclick: () => h.abrirPanel('Nueva membresía', formNueva(h)) }, 'Crear membresía'));
  }
  if (esDueno && tiene && extra && extra.m) {
    botones.push(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-editar-mem',
      onclick: () => h.abrirPanel('Editar membresía', formEditarMem(h)) }, 'Editar membresía'));
    if (est.estado !== 'vencida') {
      botones.push(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-congelar',
        onclick: () => h.abrirPanel('Congelar membresía', formCongelar(h)) }, 'Congelar'));
    }
    botones.push(crear('button', { type: 'button', class: 'boton secundario chico peligro', id: 'btn-cerrar-mem',
      onclick: () => h.abrirPanel('Cerrar membresía', h.formConfirmar({ boton: 'Cerrar membresía', claseBoton: 'peligro', motivo: true,
        texto: 'El socio queda sin membresía. Lo cobrado no se toca. Después se puede crear una nueva.',
        accion: (m) => rpc('cerrar_membresia', { p_id: extra.m.id, p_motivo: m }), mensaje: 'La membresía fue cerrada.' })) }, 'Cerrar membresía'));
  }
  return { tarjeta, botones };
}

function formNueva(h) {
  const { ctx, id, est, esDueno } = h;
  const err = crear('div', { 'aria-live': 'polite' });
  const plan = crear('select', { id: 'n-plan', required: true }, crear('option', { value: '' }, 'Cargando planes…'));
  const f = crear('form', { class: 'formulario', novalidate: true });
  let planes = [];
  const inicio = crear('input', { id: 'n-inicio', type: 'date', value: hoyEn(ctx.zona) });
  const precio = crear('input', { id: 'n-precio', type: 'text', inputmode: 'decimal' });
  const dias = selectDias('n-dias', 'Los del plan');
  const desc = crear('select', { id: 'n-desc' }, crear('option', { value: '' }, 'Sin descuento'));

  const avisoVenc = (est.estado === 'vencida' && est.dias_atraso > 60)
    ? crear('p', { class: 'aviso-caja error', id: 'aviso-reemplazo' }, 'Su membresía anterior lleva más de 60 días vencida: al crear la nueva, la anterior se cierra sola.') : null;

  f.append(avisoVenc, campo('Plan', plan));
  if (esDueno) {
    f.append(campo('Fecha de inicio', inicio, 'Por defecto es hoy. Puede ser hasta 365 días atrás o 30 adelante.'),
      campo('Precio mensual ($)', precio, 'Vacío = precio del plan. En un plan personalizado es obligatorio.'),
      campo('Días por semana', dias), campo('Descuento', desc));
  }
  f.append(err, crear('div', { class: 'fila-botones' },
    crear('button', { type: 'submit', class: 'boton' }, 'Crear membresía'),
    crear('button', { type: 'button', class: 'boton secundario', onclick: h.cerrarPanel }, 'Cancelar')));

  (async () => {
    try {
      planes = (await cargarPlanes()).filter((p) => p.activo && (esDueno || !p.personalizado));
      plan.replaceChildren(crear('option', { value: '' }, planes.length ? 'Elegí un plan…' : 'No hay planes activos'),
        ...planes.map((p) => crear('option', { value: p.id }, textoPlan(p) + (p.personalizado ? '' : ' · ' + moneda(p.precio_mensual)))));
      if (esDueno) {
        (await cargarDescuentos()).forEach((d) => desc.append(crear('option', { value: d.id }, d.nombre + ' (' + num(d.porcentaje) + ' %)')));
      }
    } catch (e) { plan.replaceChildren(crear('option', { value: '' }, 'No se pudieron cargar los planes')); }
  })();

  enviar(f, err, async () => {
    if (!plan.value) throw new Error('Elegí un plan.');
    const args = { p_socio_id: id, p_plan_id: plan.value };
    if (esDueno) {
      if (inicio.value && inicio.value !== hoyEn(ctx.zona)) args.p_fecha_inicio = inicio.value;
      const m = leerMonto(precio.value);
      if (Number.isNaN(m)) throw new Error('El precio debe ser un número (por ejemplo 15000).');
      if (m !== null) args.p_precio_mensual = m;
      if (dias.value !== '') args.p_dias_por_semana = Number(dias.value);
      if (desc.value) args.p_descuento_id = desc.value;
    }
    await rpc('crear_membresia', args);
    f.dataset.hecho = '1';
    ctx.flash = 'Membresía creada. Falta cobrar la primera cuota.';
    await h.recargar();
  });
  return f;
}

function formEditarMem(h) {
  const { extra, ctx } = h;
  const m = extra.m;
  const err = crear('div', { 'aria-live': 'polite' });
  const plan = crear('select', { id: 'x-plan' }, crear('option', { value: '' }, 'Cargando…'));
  const precio = crear('input', { id: 'x-precio', type: 'text', inputmode: 'decimal' });
  const dias = selectDias('x-dias', 'Sin cambios');
  const desc = crear('select', { id: 'x-desc' }, crear('option', { value: '' }, 'Sin cambios'), crear('option', { value: 'quitar' }, 'Quitar el descuento'));
  const f = crear('form', { class: 'formulario', novalidate: true },
    crear('p', { class: 'suave' }, 'Hoy: ' + moneda(m.precio_mensual) + ' por mes, ' + (m.dias_por_semana ? m.dias_por_semana + ' días por semana' : 'sin tope semanal') +
      (num(m.descuento_pct) > 0 ? ', con ' + num(m.descuento_pct) + ' % de descuento' : '') + '. Los cambios valen para los próximos cobros: lo ya cobrado no se modifica.'),
    campo('Plan', plan, 'Si cambiás de plan y no escribís precio ni días, se usan los del plan nuevo.'),
    campo('Precio mensual ($)', precio, 'Vacío = sin cambios.'),
    campo('Días por semana', dias), campo('Descuento', desc), err,
    crear('div', { class: 'fila-botones' },
      crear('button', { type: 'submit', class: 'boton' }, 'Guardar cambios'),
      crear('button', { type: 'button', class: 'boton secundario', onclick: h.cerrarPanel }, 'Cancelar')));
  (async () => {
    try {
      const planes = (await cargarPlanes()).filter((p) => p.activo || p.id === m.plan_id);
      plan.replaceChildren(crear('option', { value: '' }, 'Sin cambios'), ...planes.filter((p) => p.id !== m.plan_id).map((p) => crear('option', { value: p.id }, textoPlan(p))));
      (await cargarDescuentos()).forEach((d) => desc.append(crear('option', { value: d.id }, d.nombre + ' (' + num(d.porcentaje) + ' %)')));
    } catch (e) { plan.replaceChildren(crear('option', { value: '' }, 'Sin cambios')); }
  })();
  enviar(f, err, async () => {
    const args = { p_id: m.id };
    if (plan.value) args.p_plan_id = plan.value;
    const v = leerMonto(precio.value);
    if (Number.isNaN(v)) throw new Error('El precio debe ser un número (por ejemplo 15000).');
    if (v !== null) args.p_precio_mensual = v;
    if (dias.value !== '') args.p_dias_por_semana = Number(dias.value);
    if (desc.value === 'quitar') args.p_quitar_descuento = true; else if (desc.value) args.p_descuento_id = desc.value;
    if (Object.keys(args).length === 1) throw new Error('No cambiaste nada.');
    await rpc('editar_membresia', args);
    ctx.flash = 'Membresía actualizada.';
    await h.recargar();
  });
  return f;
}

function formCongelar(h) {
  const { ctx, extra } = h;
  const hoy = hoyEn(ctx.zona);
  const err = crear('div', { 'aria-live': 'polite' });
  const desde = crear('input', { id: 'c-desde', type: 'date', value: hoy, min: hoy, required: true });
  const hasta = crear('input', { id: 'c-hasta', type: 'date', min: hoy, required: true });
  const motivo = crear('textarea', { id: 'c-motivo', maxlength: '200', rows: '2', required: true });
  const f = crear('form', { class: 'formulario', novalidate: true },
    crear('p', { class: 'suave' }, 'Máximo 60 días. Los días congelados se suman al vencimiento. No puede empezar en el pasado ni después del vencimiento.'),
    campo('Desde', desde), campo('Hasta (inclusive)', hasta), campo('Motivo', motivo), err,
    crear('div', { class: 'fila-botones' },
      crear('button', { type: 'submit', class: 'boton' }, 'Congelar'),
      crear('button', { type: 'button', class: 'boton secundario', onclick: h.cerrarPanel }, 'Cancelar')));
  enviar(f, err, async () => {
    if (!desde.value || !hasta.value) throw new Error('Completá las fechas desde y hasta.');
    const r = await rpc('crear_congelamiento', { p_membresia_id: extra.m.id, p_desde: desde.value, p_hasta: hasta.value, p_motivo: motivo.value });
    ctx.flash = 'Congelamiento registrado. Nuevo vencimiento: ' + fecha(r.vence_el) + '.';
    await h.recargar();
  });
  return f;
}
