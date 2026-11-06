// Caja: abrir, cerrar, ingresos, gastos, retiros y anulaciones (Etapa 5).
import { crear, cliente, rpc, traducirError } from '../comun.js?v=9';
import { moneda, fechaHora, hoyEn } from '../formato.js?v=9';
import { campo, aviso, enviar, flash, nuevaClave } from '../ui.js?v=9';
import { leerMonto } from './ficha_membresia.js?v=9';

const TIPOS = { cobro_cuota: 'Cobro de cuota', ingreso: 'Ingreso', retiro: 'Retiro', gasto: 'Gasto', anulacion: 'Anulación' };

export function vistaCaja(contenedor, ctx) {
  let activa = true;
  const esDueno = ctx.perfil.rol === 'dueno';
  const mensajes = crear('div', { class: 'zona-mensajes', 'aria-live': 'polite' });
  const zona = crear('div', { 'aria-live': 'polite' });
  const panel = crear('div', { class: 'panel-accion' });
  contenedor.replaceChildren(crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Caja')), mensajes, zona, panel);
  flash(ctx, mensajes);
  zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));

  const cerrarPanel = () => panel.replaceChildren();
  const abrirPanel = (titulo, cont) => { panel.replaceChildren(crear('h3', {}, titulo), cont); panel.scrollIntoView({ block: 'nearest' }); };

  async function listas() {
    const [m, c] = await Promise.all([
      cliente().from('medios_pago').select('id, nombre, es_efectivo, activo').order('nombre'),
      cliente().from('categorias_gasto').select('id, nombre, activo').order('nombre'),
    ]);
    if (m.error) throw m.error;
    if (c.error) throw c.error;
    return { medios: m.data || [], categorias: c.data || [] };
  }

  async function cargar() {
    try {
      const est = await rpc('estado_de_caja');
      const l = await listas();
      let movs = [];
      if (est.hay_caja) {
        const { data, error } = await cliente().from('movimientos')
          .select('id, tipo, monto, medio_pago_id, concepto, anula_a, creado_en')
          .eq('caja_id', est.caja.id).order('creado_en', { ascending: false });
        if (error) throw error;
        movs = data || [];
      }
      if (!activa) return;
      pintar(est, l, movs);
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }

  async function terminado(texto) {
    ctx.flash = texto; mensajes.replaceChildren(); cerrarPanel(); flash(ctx, mensajes); await cargar();
  }

  function selectDe(id, items, vacio) {
    const s = crear('select', { id, required: true }, crear('option', { value: '' }, items.length ? vacio : 'No hay opciones: creálas en Configuración'));
    items.forEach((x) => s.append(crear('option', { value: x.id }, x.nombre)));
    return s;
  }
  const montoTxt = (id) => crear('input', { id, type: 'text', inputmode: 'decimal', required: true });
  const pedirMonto = (el) => {
    const v = leerMonto(el.value);
    if (v === null || Number.isNaN(v) || v <= 0) throw new Error('Escribí un monto mayor a 0 (solo números, por ejemplo 1500).');
    return v;
  };
  function botonesForm(texto) {
    return crear('div', { class: 'fila-botones' },
      crear('button', { type: 'submit', class: 'boton' }, texto),
      crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar'));
  }

  // ---------- Formularios ----------
  function formAbrir() {
    const monto = crear('input', { id: 'a-monto', type: 'text', inputmode: 'decimal', value: '0' });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', id: 'form-abrir', novalidate: true },
      campo('Efectivo con el que abre la caja ($)', monto, 'Lo que hay en el cajón al empezar. Puede ser 0.'), err, botonesForm('Abrir caja'));
    enviar(f, err, async () => {
      const v = leerMonto(monto.value);
      if (v === null || Number.isNaN(v) || v < 0) throw new Error('El monto inicial debe ser un número (0 o más).');
      await rpc('abrir_caja', { p_monto_inicial: v });
      f.dataset.hecho = '1';
      await terminado('Caja abierta.');
    });
    return f;
  }

  function formIngreso(l, sinCaja) {
    const clave = nuevaClave();
    const medio = selectDe('g-medio', l.medios.filter((x) => x.activo), 'Elegí el medio de pago…');
    const monto = montoTxt('g-monto');
    const concepto = crear('input', { id: 'g-concepto', type: 'text', maxlength: '200', required: true });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      sinCaja ? crear('p', { class: 'aviso-caja error', id: 'aviso-sin-caja' }, 'No hay caja abierta: este movimiento queda sin caja y no entra en el arqueo.') : null,
      crear('p', { class: 'suave' }, 'Para plata que entra y no es una cuota (por ejemplo, venta de agua).'),
      campo('Medio de pago', medio), campo('Monto ($)', monto), campo('Concepto', concepto), err, botonesForm('Registrar ingreso'));
    enviar(f, err, async () => {
      if (!medio.value) throw new Error('Elegí el medio de pago.');
      await rpc('registrar_ingreso', { p_clave: clave, p_medio_pago_id: medio.value, p_monto: pedirMonto(monto), p_concepto: concepto.value });
      f.dataset.hecho = '1'; await terminado('Ingreso registrado.');
    });
    return f;
  }

  function formGasto(l, sinCaja) {
    const clave = nuevaClave();
    const cat = selectDe('x-cat', l.categorias.filter((x) => x.activo), 'Elegí la categoría…');
    const medio = selectDe('x-medio', l.medios.filter((x) => x.activo), 'Elegí el medio de pago…');
    const monto = montoTxt('x-monto');
    const desc = crear('input', { id: 'x-desc', type: 'text', maxlength: '200', required: true });
    const fecha = esDueno ? crear('input', { id: 'x-fecha', type: 'date', value: hoyEn(ctx.zona) }) : null;
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      sinCaja ? crear('p', { class: 'aviso-caja error', id: 'aviso-sin-caja' }, 'No hay caja abierta: este gasto queda sin caja y no entra en el arqueo.') : null,
      esDueno ? null : crear('p', { class: 'suave' }, 'Recepción puede cargar gastos de hoy y de hasta $50.000.'),
      campo('Categoría', cat), campo('Medio de pago', medio), campo('Monto ($)', monto), campo('Descripción', desc),
      fecha ? campo('Fecha del gasto', fecha, 'Hasta 365 días atrás.') : null, err, botonesForm('Registrar gasto'));
    enviar(f, err, async () => {
      if (!cat.value) throw new Error('Elegí la categoría.');
      if (!medio.value) throw new Error('Elegí el medio de pago.');
      const args = { p_clave: clave, p_categoria_id: cat.value, p_medio_pago_id: medio.value, p_monto: pedirMonto(monto), p_descripcion: desc.value };
      if (fecha && fecha.value && fecha.value !== hoyEn(ctx.zona)) args.p_fecha = fecha.value;
      await rpc('registrar_gasto', args);
      f.dataset.hecho = '1'; await terminado('Gasto registrado.');
    });
    return f;
  }

  function formRetiro(l) {
    const clave = nuevaClave();
    const efectivos = l.medios.filter((x) => x.activo && x.es_efectivo);
    const medio = selectDe('r-medio', efectivos, 'Elegí el medio (efectivo)…');
    const monto = montoTxt('r-monto');
    const concepto = crear('input', { id: 'r-concepto', type: 'text', maxlength: '200', required: true });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      crear('p', { class: 'suave' }, 'Plata que sacás de la caja (por ejemplo, un depósito en el banco). No puede ser más que el efectivo que hay.'),
      campo('Medio de pago', medio), campo('Monto ($)', monto), campo('Concepto', concepto), err, botonesForm('Registrar retiro'));
    enviar(f, err, async () => {
      if (!medio.value) throw new Error('Elegí el medio de pago.');
      await rpc('registrar_retiro', { p_clave: clave, p_medio_pago_id: medio.value, p_monto: pedirMonto(monto), p_concepto: concepto.value });
      f.dataset.hecho = '1'; await terminado('Retiro registrado.');
    });
    return f;
  }

  function formCerrar(est) {
    const vieja = est.de_dia_anterior;
    const contado = montoTxt('c-contado');
    const notas = crear('textarea', { id: 'c-notas', maxlength: '300', rows: '2' });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', id: 'form-cerrar', novalidate: true },
      crear('p', { class: 'suave' }, 'Contá el efectivo que hay en el cajón y escribilo. ' + (esDueno ? 'Te mostramos la diferencia con lo esperado.' : 'El sistema guarda la diferencia para el dueño.')),
      campo('Efectivo contado ($)', contado, 'Si no hay nada, escribí 0.'),
      campo(vieja ? 'Notas (obligatorio: ¿por qué quedó abierta?)' : 'Notas (opcional)', notas), err, botonesForm('Cerrar caja'));
    enviar(f, err, async () => {
      const v = leerMonto(contado.value);
      if (v === null || Number.isNaN(v) || v < 0) throw new Error('Escribí el efectivo contado (un número, 0 si no hay).');
      if (vieja && !notas.value.trim()) throw new Error('Escribí en las notas por qué se cierra una caja de un día anterior.');
      const r = await rpc('cerrar_caja', { p_caja_id: est.caja.id, p_monto_contado: v, p_notas: notas.value.trim() || null });
      f.dataset.hecho = '1';
      if (r.diferencia != null) {
        const d = Number(r.diferencia);
        await terminado('Caja cerrada. Esperado ' + moneda(r.monto_esperado) + ' · contado ' + moneda(r.monto_contado) + ' · ' +
          (d === 0 ? 'sin diferencia.' : (d > 0 ? 'sobran ' : 'faltan ') + moneda(Math.abs(d)) + '.'));
      } else await terminado('Caja cerrada. Quedó registrado lo que contaste.');
    });
    return f;
  }

  function formAnular(mov) {
    const clave = nuevaClave();
    const motivo = crear('textarea', { id: 'n-motivo', maxlength: '180', rows: '2', required: true });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      crear('p', {}, 'Se agrega un movimiento inverso: el original queda registrado. Si fue en efectivo hace falta una caja abierta.'),
      campo('Motivo', motivo), err, botonesForm('Anular'));
    enviar(f, err, async () => {
      await rpc('anular_movimiento', { p_clave: clave, p_movimiento_id: mov.id, p_motivo: motivo.value });
      f.dataset.hecho = '1'; await terminado('Movimiento anulado.');
    });
    return f;
  }

  // ---------- Pantalla ----------
  function pintar(est, l, movs) {
    const nombreMedio = (id) => { const m = l.medios.find((x) => x.id === id); return m ? m.nombre : '—'; };
    const bloques = [];
    const botones = crear('div', { class: 'fila-botones acciones' });
    const hayCaja = est.hay_caja;
    const vieja = hayCaja && est.de_dia_anterior;

    if (!hayCaja) {
      bloques.push(crear('div', { class: 'tarjeta', id: 'sin-caja' }, crear('h3', {}, 'No hay una caja abierta'),
        crear('p', { class: 'suave' }, 'Para cobrar cuotas y registrar movimientos hay que abrir la caja.'),
        crear('button', { type: 'button', class: 'boton chico', id: 'btn-abrir', onclick: () => abrirPanel('Abrir caja', formAbrir()) }, 'Abrir caja')), botones);
      if (esDueno) {
        botones.append(
          crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-ingreso', onclick: () => abrirPanel('Ingreso', formIngreso(l, true)) }, 'Ingreso sin caja'),
          crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-gasto', onclick: () => abrirPanel('Gasto', formGasto(l, true)) }, 'Gasto sin caja'));
      }
    } else {
      const c = est.caja;
      const dl = crear('dl', { class: 'detalle-socio' },
        crear('dt', {}, 'Abierta'), crear('dd', {}, fechaHora(c.abierta_en, ctx.zona) + (c.abierta_por === ctx.perfil.id ? ' (por vos)' : '')),
        crear('dt', {}, 'Efectivo inicial'), crear('dd', {}, moneda(c.monto_inicial)));
      if (esDueno && c.monto_esperado != null) dl.append(crear('dt', {}, 'Efectivo esperado'), crear('dd', { id: 'esperado' }, moneda(c.monto_esperado)));
      bloques.push(crear('div', { class: 'tarjeta', id: 'caja-abierta' }, crear('h3', {}, 'Caja abierta'), dl));
      if (vieja) {
        bloques.push(aviso(esDueno ? 'Esta caja quedó abierta de un día anterior. Cerrala escribiendo en las notas por qué.'
          : 'Esta caja quedó abierta de un día anterior. Pedile al dueño que la cierre: hasta entonces no se puede operar.', 'error'));
        bloques[bloques.length - 1].id = 'aviso-vieja';
      }
      if (!vieja) {
        botones.append(
          crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-ingreso', onclick: () => abrirPanel('Ingreso', formIngreso(l, false)) }, 'Ingreso'),
          crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-gasto', onclick: () => abrirPanel('Gasto', formGasto(l, false)) }, 'Gasto'));
        if (esDueno) botones.append(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-retiro', onclick: () => abrirPanel('Retiro', formRetiro(l)) }, 'Retiro'));
      }
      if (!vieja || esDueno) botones.append(crear('button', { type: 'button', class: 'boton chico', id: 'btn-cerrar', onclick: () => abrirPanel('Cerrar caja', formCerrar(est)) }, 'Cerrar caja'));

      const anulados = new Set(movs.filter((m) => m.anula_a).map((m) => m.anula_a));
      const lista = crear('ul', { class: 'lista-planes', id: 'movimientos' });
      movs.forEach((m) => {
        const anulado = anulados.has(m.id);
        const entra = Number(m.monto) > 0;
        const item = crear('li', { class: 'plan-item mov' + (anulado ? ' anulado' : ''), 'data-mov': m.id },
          crear('div', { class: 'plan-info' },
            crear('strong', {}, TIPOS[m.tipo] || m.tipo),
            crear('span', { class: 'suave' }, m.concepto + ' · ' + nombreMedio(m.medio_pago_id) + ' · ' + fechaHora(m.creado_en, ctx.zona))),
          crear('span', { class: 'importe ' + (entra ? 'entra' : 'sale') }, (entra ? '+' : '−') + moneda(Math.abs(Number(m.monto)))));
        if (anulado) item.append(crear('span', { class: 'pastilla neutro' }, 'Anulado'));
        if (esDueno && !anulado && ['ingreso', 'retiro', 'gasto'].includes(m.tipo)) {
          item.append(crear('div', { class: 'fila-botones' }, crear('button', { type: 'button', class: 'boton secundario chico', 'data-anular': m.id,
            onclick: () => abrirPanel('Anular movimiento', formAnular(m)) }, 'Anular')));
        }
        if (m.tipo === 'cobro_cuota' && esDueno) item.append(crear('span', { class: 'suave nota-cobro' }, 'Se anula desde el cobro.'));
        lista.append(item);
      });
      bloques.push(botones, crear('h3', { class: 'titulo-lista' }, 'Movimientos de esta caja'),
        movs.length ? lista : crear('p', { class: 'suave', id: 'sin-movs' }, 'Todavía no hay movimientos.'));
    }
    zona.replaceChildren(...bloques);
  }

  cargar();
  return () => { activa = false; };
}
