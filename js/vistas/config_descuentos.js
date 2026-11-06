// Configuración · Descuentos y paquetes de pago adelantado (solo dueño).
import { crear, cliente, rpc, traducirError } from '../comun.js?v=11';
import { campo, aviso, enviar, flash } from '../ui.js?v=11';

const CATEGORIAS = { plan: 'Plan', familiar: 'Familiar', promo: 'Promoción', otro: 'Otro' };
const num = (t) => Number(String(t).trim().replace(',', '.'));
const pct = (n) => String(Number(n)).replace('.', ',') + ' %';
const textoPct = (v, nombre) => { const n = num(v); if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Escribí el porcentaje de ' + nombre + ' como número (ejemplo: 10 o 12,5).'); return n; };

export function vistaDescuentos(contenedor, ctx) {
  let activa = true;
  const zD = crear('div', { 'aria-live': 'polite', id: 'zona-descuentos' });
  const zP = crear('div', { 'aria-live': 'polite', id: 'zona-paquetes' });
  const panel = crear('div', { class: 'panel-accion' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Descuentos y paquetes')),
    crear('p', { class: 'suave' }, 'Cambiar un porcentaje no modifica lo ya cobrado ni las membresías ya creadas: guardan el que tenían. Si un cobro tiene varios descuentos, gana el mayor; no se suman.'),
    mensajes, panel,
    crear('div', { class: 'cabecera-vista' }, crear('h3', {}, 'Descuentos de membresía'),
      crear('button', { type: 'button', class: 'boton chico', id: 'btn-nuevo-desc', onclick: () => formDesc(null) }, 'Nuevo descuento')),
    zD,
    crear('div', { class: 'cabecera-vista' }, crear('h3', {}, 'Paquetes de pago adelantado'),
      crear('button', { type: 'button', class: 'boton chico', id: 'btn-nuevo-paq', onclick: () => formPaq(null) }, 'Nuevo paquete')),
    crear('p', { class: 'suave' }, 'Para cobrar varios meses juntos (por ejemplo 3 meses con un descuento). Los meses no se pueden cambiar después.'),
    zP);
  flash(ctx, mensajes);

  const cerrar = () => panel.replaceChildren();
  async function listo(texto) { ctx.flash = texto; cerrar(); mensajes.replaceChildren(); flash(ctx, mensajes); await Promise.all([cargarD(), cargarP()]); }
  const botones = (t) => crear('div', { class: 'fila-botones' },
    crear('button', { type: 'submit', class: 'boton' }, t), crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cancelar'));

  function formDesc(d) {
    const nombre = crear('input', { id: 'd-nombre', type: 'text', maxlength: '40', required: true, value: d ? d.nombre : '' });
    const cat = crear('select', { id: 'd-categoria' }, Object.entries(CATEGORIAS).map(([k, v]) => crear('option', { value: k, selected: d ? d.categoria === k : k === 'otro' }, v)));
    const p = crear('input', { id: 'd-pct', type: 'text', inputmode: 'decimal', maxlength: '6', required: true, value: d ? String(Number(d.porcentaje)).replace('.', ',') : '' });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true }, campo('Nombre', nombre), campo('Categoría', cat), campo('Porcentaje de descuento', p, 'Mayor a 0 y menor a 100.'), err, botones(d ? 'Guardar' : 'Crear'));
    panel.replaceChildren(crear('h3', {}, d ? 'Editar descuento' : 'Nuevo descuento'), f);
    enviar(f, err, async () => {
      const n = textoPct(p.value, 'descuento');
      if (d) { await rpc('editar_descuento', { p_id: d.id, p_nombre: nombre.value, p_categoria: cat.value, p_porcentaje: n }); await listo('Descuento guardado.'); }
      else { await rpc('crear_descuento', { p_nombre: nombre.value, p_porcentaje: n, p_categoria: cat.value }); await listo('Descuento creado.'); }
    });
  }

  function formPaq(pq) {
    const nombre = crear('input', { id: 'q-nombre', type: 'text', maxlength: '40', required: true, value: pq ? pq.nombre : '' });
    const meses = pq ? crear('p', { id: 'q-meses-fijo' }, pq.meses + ' meses') : crear('input', { id: 'q-meses', type: 'text', inputmode: 'numeric', maxlength: '2', required: true });
    const p = crear('input', { id: 'q-pct', type: 'text', inputmode: 'decimal', maxlength: '6', required: true, value: pq ? String(Number(pq.descuento_pct)).replace('.', ',') : '0' });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true }, campo('Nombre', nombre),
      pq ? crear('div', { class: 'campo' }, crear('label', {}, 'Meses'), meses) : campo('Meses (de 2 a 24)', meses),
      campo('Descuento del paquete', p, '0 si no tiene descuento; hasta 99,99.'), err, botones(pq ? 'Guardar' : 'Crear'));
    panel.replaceChildren(crear('h3', {}, pq ? 'Editar paquete' : 'Nuevo paquete'), f);
    enviar(f, err, async () => {
      const n = textoPct(p.value, 'descuento');
      if (pq) { await rpc('editar_paquete', { p_id: pq.id, p_nombre: nombre.value, p_descuento_pct: n }); await listo('Paquete guardado.'); }
      else {
        const m = meses.value.trim();
        if (!/^[0-9]{1,2}$/.test(m)) throw new Error('Los meses del paquete deben ser un número entero de 2 a 24.');
        await rpc('crear_paquete', { p_nombre: nombre.value, p_meses: Number(m), p_descuento_pct: n }); await listo('Paquete creado.');
      }
    });
  }

  async function alternar(rpcNombre, fila, zona) {
    mensajes.replaceChildren();
    const estabaActivo = fila.activo;
    try { await rpc(rpcNombre, { p_id: fila.id, p_activo: !estabaActivo }); await listo(estabaActivo ? 'Desactivado.' : 'Activado.'); }
    catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
  }

  const fila = (clave, id, activo, info, editar, alternarFn) => crear('li', { class: 'plan-item', ['data-' + clave]: id },
    crear('div', { class: 'plan-info' }, info), crear('span', { class: 'pastilla ' + (activo ? 'ok' : 'neutro') }, activo ? 'Activo' : 'Inactivo'),
    crear('div', { class: 'fila-botones' },
      crear('button', { type: 'button', class: 'boton secundario chico', ['data-editar-' + clave]: id, onclick: editar }, 'Editar'),
      crear('button', { type: 'button', class: 'boton secundario chico', ['data-alternar-' + clave]: id, onclick: alternarFn }, activo ? 'Desactivar' : 'Activar')));

  async function cargarD() {
    try {
      const { data, error } = await cliente().from('descuentos').select('id, nombre, categoria, porcentaje, activo').order('activo', { ascending: false }).order('nombre');
      if (error) throw error;
      if (!activa) return;
      zD.replaceChildren(!data.length ? crear('p', { class: 'suave' }, 'Todavía no hay descuentos.')
        : crear('ul', { class: 'lista-planes', id: 'lista-descuentos' }, data.map((d) => fila('desc', d.id, d.activo,
          [crear('strong', {}, d.nombre), crear('span', { class: 'suave' }, (CATEGORIAS[d.categoria] || d.categoria) + ' · ' + pct(d.porcentaje))],
          () => formDesc(d), () => alternar('editar_descuento', d)))));
    } catch (e) { if (activa) zD.replaceChildren(aviso(traducirError(e))); }
  }
  async function cargarP() {
    try {
      const { data, error } = await cliente().from('paquetes_adelantado').select('id, nombre, meses, descuento_pct, activo').order('activo', { ascending: false }).order('meses');
      if (error) throw error;
      if (!activa) return;
      zP.replaceChildren(!data.length ? crear('p', { class: 'suave' }, 'Todavía no hay paquetes.')
        : crear('ul', { class: 'lista-planes', id: 'lista-paquetes' }, data.map((q) => fila('paq', q.id, q.activo,
          [crear('strong', {}, q.nombre), crear('span', { class: 'suave' }, q.meses + ' meses · ' + (Number(q.descuento_pct) > 0 ? pct(q.descuento_pct) + ' de descuento' : 'sin descuento'))],
          () => formPaq(q), () => alternar('editar_paquete', q)))));
    } catch (e) { if (activa) zP.replaceChildren(aviso(traducirError(e))); }
  }
  cargarD(); cargarP();
  return () => { activa = false; };
}
