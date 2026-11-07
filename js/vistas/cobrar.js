// Cobrar cuotas y recibo (Etapa 6).
// Rutas: #/cobrar (buscar socio) · #/cobrar/<socio> (cobro) · #/cobrar/<socio>/recibo/<cobro> (recibo).
import { crear, cliente, rpc, traducirError } from '../comun.js?v=17';
import { moneda, fecha, fechaHora } from '../formato.js?v=17';
import { campo, aviso, enviar, flash, nuevaClave, esUuid } from '../ui.js?v=17';
import { busqueda } from './socios.js?v=17';

export function vistaCobrar(contenedor, ctx, params) {
  const socio = (params && params[0]) || '';
  if (esUuid(socio) && params[1] === 'recibo' && esUuid(params[2] || '')) return vistaRecibo(contenedor, ctx, socio, params[2]);
  if (esUuid(socio)) return vistaCobro(contenedor, ctx, socio);
  return busqueda(contenedor, ctx, { titulo: 'Cobrar', base: '#/cobrar/', conAlta: false });
}

const nombreDescuento = (c) => (c.paquete_id ? 'Descuento por pago adelantado' : 'Descuento de la membresía');

// Detalle del cálculo (sirve para la pantalla de cobro y para el recibo)
export function detalleCobro(c) {
  const dl = crear('dl', { class: 'detalle-socio', id: 'detalle-cobro' });
  const f = (a, b, id) => dl.append(crear('dt', {}, a), crear('dd', id ? { id } : {}, b));
  f('Período', fecha(c.desde) + ' al ' + fecha(c.hasta), 'd-periodo');
  f(c.meses === 1 ? 'Cuota (1 mes)' : 'Cuota (' + c.meses + ' meses)', moneda(c.precio_mensual) + (c.meses > 1 ? ' × ' + c.meses + ' = ' + moneda(c.subtotal) : ''), 'd-subtotal');
  if (Number(c.descuento_pct) > 0) {
    const ahorro = Math.round((Number(c.subtotal) * Number(c.descuento_pct))) / 100;
    f(nombreDescuento(c) + ' (' + Number(c.descuento_pct) + ' %)', '−' + moneda(ahorro), 'd-descuento');
  }
  if (Number(c.recargo_pct) > 0) f('Recargo por atraso (' + c.dias_atraso + ' días · ' + Number(c.recargo_pct) + ' %)', '+' + moneda(c.recargo_monto), 'd-recargo');
  else if (c.recargo_perdonado) f('Recargo por atraso', 'Perdonado', 'd-recargo');
  f('Total', moneda(c.monto_total), 'd-total');
  return dl;
}

function vistaCobro(contenedor, ctx, socioId) {
  let activa = true;
  const esDueno = ctx.perfil.rol === 'dueno';
  const clave = nuevaClave();
  let temporizador = null;
  let pedido = 0;
  let calc = null;
  const zona = crear('div', { 'aria-live': 'polite' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/cobrar', class: 'enlace-simple', id: 'volver-cobrar' }, '← Buscar otro socio')), zona);

  async function cargar() {
    try {
      const est = await rpc('estado_de_socio', { p_socio_id: socioId });
      const caja = await rpc('estado_de_caja');
      const { data: medios, error } = await cliente().from('medios_pago').select('id, nombre, es_efectivo, activo').order('nombre');
      if (error) throw error;
      if (!activa) return;
      pintar(est, caja, (medios || []).filter((m) => m.activo));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }

  function cabecera(est) {
    return crear('div', { class: 'cabecera-ficha' },
      crear('div', {}, crear('h2', { id: 'cobro-nombre' }, 'Cobrar a ' + est.apellido + ', ' + est.nombre), crear('p', { class: 'suave' }, 'N.º de socio ' + est.numero + (est.plan ? ' · ' + est.plan : ''))));
  }

  function pintar(est, caja, medios) {
    const enlaceFicha = crear('a', { href: '#/socios/' + socioId, class: 'enlace-simple', id: 'ir-ficha' }, 'Ver la ficha del socio');
    if (est.estado === 'baja' || est.estado === 'sin_membresia') {
      zona.replaceChildren(cabecera(est), crear('div', { class: 'tarjeta', id: 'no-se-cobra' },
        crear('p', {}, est.estado === 'baja' ? 'Este socio está dado de baja: no se le puede cobrar.' : 'Este socio no tiene una membresía activa. Primero creala desde su ficha.'), enlaceFicha));
      return;
    }
    const bloqueada = !esDueno && (!caja.hay_caja || caja.de_dia_anterior);
    if (bloqueada) {
      zona.replaceChildren(cabecera(est), crear('div', { class: 'tarjeta', id: 'necesita-caja' },
        crear('p', {}, caja.hay_caja ? 'La caja abierta es de un día anterior: pedile al dueño que la cierre antes de cobrar.' : 'Para cobrar hay que abrir la caja.'),
        caja.hay_caja ? null : crear('a', { href: '#/caja', class: 'boton chico enlace-boton', id: 'ir-caja' }, 'Ir a Caja')));
      return;
    }

    const meses = crear('input', { id: 'k-meses', type: 'number', min: '1', max: '24', step: '1', value: '1', inputmode: 'numeric' });
    const medio = crear('select', { id: 'k-medio', required: true }, crear('option', { value: '' }, medios.length ? 'Elegí el medio de pago…' : 'No hay medios: creálos en Configuración'));
    medios.forEach((m) => medio.append(crear('option', { value: m.id }, m.nombre)));
    const perdonar = esDueno ? crear('input', { id: 'k-perdonar', type: 'checkbox' }) : null;
    const motivo = esDueno ? crear('input', { id: 'k-motivo', type: 'text', maxlength: '120' }) : null;
    const filaMotivo = esDueno ? crear('div', { id: 'fila-motivo', hidden: true }, campo('Motivo por el que se perdona', motivo)) : null;
    const detalle = crear('div', { id: 'zona-detalle', 'aria-live': 'polite' });
    const err = crear('div', { 'aria-live': 'polite' });
    const boton = crear('button', { type: 'submit', class: 'boton', id: 'btn-cobrar', disabled: true }, 'Cobrar');

    const f = crear('form', { class: 'formulario', novalidate: true },
      !caja.hay_caja ? crear('p', { class: 'aviso-caja error', id: 'aviso-sin-caja' }, 'No hay caja abierta: este cobro queda sin caja y no entra en el arqueo.') : null,
      campo('Meses a cobrar', meses, (ctx.edicion === 'base' ? 'De 1 a 24.' : 'De 1 a 24. Si hay un paquete por adelantado para esa cantidad, el sistema aplica el descuento.')),
      campo('Medio de pago', medio),
      esDueno ? crear('div', { class: 'campo casilla' }, perdonar, crear('label', { for: 'k-perdonar' }, 'Perdonar el recargo por atraso')) : null,
      filaMotivo, detalle, err, boton);

    zona.replaceChildren(cabecera(est), crear('div', { class: 'tarjeta' }, f));

    async function recalcular() {
      const mio = ++pedido;
      const n = Number(meses.value);
      calc = null; boton.disabled = true; boton.textContent = 'Cobrar';
      if (!Number.isInteger(n) || n < 1 || n > 24) { detalle.replaceChildren(aviso('Los meses deben estar entre 1 y 24.')); return; }
      detalle.replaceChildren(crear('p', { class: 'suave' }, 'Calculando…'));
      try {
        const r = await rpc('calcular_cobro', { p_membresia_id: est.membresia_id, p_meses: n, p_perdonar_recargo: !!(perdonar && perdonar.checked) });
        if (!activa || mio !== pedido) return;
        calc = r;
        detalle.replaceChildren(detalleCobro(r), crear('p', { class: 'suave', id: 'vence-despues' }, 'Queda al día hasta el ' + fecha(r.vence_despues) + '.'));
        boton.textContent = 'Cobrar ' + moneda(r.monto_total); boton.disabled = false;
      } catch (e) { if (activa && mio === pedido) detalle.replaceChildren(aviso(traducirError(e))); }
    }
    const diferido = () => { clearTimeout(temporizador); temporizador = setTimeout(recalcular, 250); };
    meses.addEventListener('input', diferido);
    if (perdonar) perdonar.addEventListener('change', () => { filaMotivo.hidden = !perdonar.checked; recalcular(); });

    enviar(f, err, async () => {
      if (!calc) throw new Error('Revisá los meses: todavía no hay un importe calculado.');
      if (!medio.value) throw new Error('Elegí el medio de pago.');
      const perdona = !!(perdonar && perdonar.checked);
      if (perdona && !motivo.value.trim()) throw new Error('Escribí el motivo por el que se perdona el recargo.');
      const args = { p_clave: clave, p_membresia_id: est.membresia_id, p_meses: calc.meses, p_medio_pago_id: medio.value,
        p_monto_esperado: Number(calc.monto_total), p_hasta_esperado: calc.hasta };
      if (perdona) { args.p_perdonar_recargo = true; args.p_motivo = motivo.value.trim(); }
      try {
        const r = await rpc('cobrar_cuota', args);
        f.dataset.hecho = '1';
        ctx.flash = 'Cobro registrado.';
        location.hash = '#/cobrar/' + socioId + '/recibo/' + r.id;
      } catch (e) {
        // Si cambió el importe o el período, recalculamos para que lo revise antes de confirmar de nuevo.
        if (/Revisá y confirmá de nuevo/.test(String(e && e.message))) { recalcular(); }
        throw e;
      }
    });
    recalcular();
  }

  cargar();
  return () => { activa = false; clearTimeout(temporizador); };
}

function textoRecibo(r) {
  const l = [(r.gimnasio || '') + ' · Recibo N.º ' + String(r.recibo).padStart(6, '0') + (r.anulado ? ' (ANULADO)' : ''),
    'Socio: ' + r.socio_apellido + ', ' + r.socio_nombre + ' (N.º ' + r.socio_numero + ')',
    'Plan: ' + r.plan, 'Período: ' + fecha(r.desde) + ' al ' + fecha(r.hasta),
    'Total: ' + moneda(r.monto_total) + ' · ' + r.medio_pago,
    'Comprobante interno, no es una factura.'];
  return l.join('\n');
}

function vistaRecibo(contenedor, ctx, socioId, cobroId) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', { class: 'no-imprimir' }, crear('a', { href: '#/socios/' + socioId, class: 'enlace-simple', id: 'volver-ficha' }, '← Volver a la ficha')), mensajes, zona);
  flash(ctx, mensajes);

  (async () => {
    try {
      const r = await rpc('recibo_de_cobro', { p_cobro_id: cobroId });
      if (!activa) return;
      const monto = crear('dl', { class: 'detalle-socio' });
      const f = (a, b) => monto.append(crear('dt', {}, a), crear('dd', {}, b));
      f('Socio', r.socio_apellido + ', ' + r.socio_nombre + ' (N.º ' + r.socio_numero + ')');
      f('Plan', r.plan);
      f('Medio de pago', r.medio_pago);
      f('Cobrado por', r.cobrado_por);
      f('Fecha', fechaHora(r.creado_en, ctx.zona));
      const copiar = async () => {
        const texto = textoRecibo(r);
        try {
          if (navigator.share) { await navigator.share({ text: texto }); return; }
          await navigator.clipboard.writeText(texto);
          mensajes.replaceChildren(aviso('Texto del recibo copiado.', 'ok'));
        } catch (_) { /* el usuario canceló */ }
      };
      zona.replaceChildren(crear('div', { class: 'tarjeta recibo', id: 'recibo' },
        crear('h2', {}, r.gimnasio || ''),
        crear('p', { class: 'suave' }, 'Recibo N.º ' + String(r.recibo).padStart(6, '0') + ' · Comprobante interno (no es una factura)'),
        r.anulado ? crear('p', { class: 'aviso-caja error', id: 'recibo-anulado' }, 'ANULADO' + (r.anulado_motivo ? ': ' + r.anulado_motivo : '')) : null,
        monto, detalleCobro({ desde: r.desde, hasta: r.hasta, meses: r.meses, precio_mensual: r.precio_mensual, subtotal: r.subtotal, descuento_pct: r.descuento_pct,
          paquete_id: r.paquete_id, recargo_pct: r.recargo_pct, dias_atraso: r.dias_atraso, recargo_monto: r.recargo_monto, monto_total: r.monto_total })),
        crear('div', { class: 'fila-botones acciones no-imprimir' },
          crear('button', { type: 'button', class: 'boton chico', id: 'btn-imprimir', onclick: () => window.print() }, 'Imprimir'),
          crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-compartir', onclick: copiar }, 'Compartir / copiar'),
          crear('a', { href: '#/cobrar', class: 'boton secundario chico enlace-boton', id: 'otro-cobro' }, 'Cobrar a otro socio')));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();
  return () => { activa = false; };
}
