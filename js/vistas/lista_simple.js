// Lista simple de "nombre + activo" (medios de pago y categorías de gasto). Solo dueño.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=10';
import { campo, aviso, enviar, flash } from '../ui.js?v=10';

export function vistaListaSimple(contenedor, ctx, cfg) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  const panel = crear('div', { class: 'panel-accion' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, cfg.titulo),
      crear('button', { type: 'button', class: 'boton chico', id: 'btn-nuevo-item', onclick: () => abrir(null) }, cfg.botonNuevo)),
    crear('p', { class: 'suave' }, cfg.ayuda), mensajes, panel, zona);
  flash(ctx, mensajes);

  function cerrar() { panel.replaceChildren(); }

  function abrir(it) {
    const nombre = crear('input', { id: 'i-nombre', type: 'text', maxlength: '40', required: true, value: it ? it.nombre : '' });
    const ef = cfg.conEfectivo && !it ? crear('input', { id: 'i-efectivo', type: 'checkbox' }) : null;
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      campo('Nombre', nombre),
      ef ? crear('div', { class: 'campo casilla' }, ef, crear('label', { for: 'i-efectivo' }, 'Es efectivo (entra en el arqueo de caja). No se puede cambiar después.')) : null,
      err,
      crear('div', { class: 'fila-botones' },
        crear('button', { type: 'submit', class: 'boton' }, it ? 'Guardar' : 'Crear'),
        crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cancelar')));
    panel.replaceChildren(crear('h3', {}, it ? 'Editar' : cfg.botonNuevo), f);
    enviar(f, err, async () => {
      if (it) { await rpc(cfg.editarRpc, { p_id: it.id, p_nombre: nombre.value }); ctx.flash = 'Cambios guardados.'; }
      else {
        const args = { p_nombre: nombre.value }; if (ef) args.p_es_efectivo = ef.checked;
        await rpc(cfg.crearRpc, args); ctx.flash = cfg.creado;
      }
      cerrar(); mensajes.replaceChildren(); flash(ctx, mensajes); await cargar();
    });
  }

  async function alternar(it) {
    mensajes.replaceChildren();
    try {
      await rpc(cfg.editarRpc, { p_id: it.id, p_activo: !it.activo });
      ctx.flash = it.activo ? 'Desactivado.' : 'Activado.'; flash(ctx, mensajes); await cargar();
    } catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
  }

  async function cargar() {
    try {
      const { data, error } = await cliente().from(cfg.tabla).select(cfg.columnas).order('activo', { ascending: false }).order('nombre');
      if (error) throw error;
      if (!activa) return;
      if (!data.length) { zona.replaceChildren(crear('p', { class: 'suave' }, 'Todavía no hay ninguno.')); return; }
      zona.replaceChildren(crear('ul', { class: 'lista-planes' }, data.map((it) => crear('li', { class: 'plan-item', 'data-item': it.id },
        crear('div', { class: 'plan-info' }, crear('strong', {}, it.nombre), it.es_efectivo ? crear('span', { class: 'suave' }, 'Efectivo (entra en el arqueo)') : null),
        crear('span', { class: 'pastilla ' + (it.activo ? 'ok' : 'neutro') }, it.activo ? 'Activo' : 'Inactivo'),
        crear('div', { class: 'fila-botones' },
          crear('button', { type: 'button', class: 'boton secundario chico', 'data-editar': it.id, onclick: () => abrir(it) }, 'Editar'),
          crear('button', { type: 'button', class: 'boton secundario chico', 'data-alternar': it.id, onclick: () => alternar(it) }, it.activo ? 'Desactivar' : 'Activar'))))));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }
  cargar();
  return () => { activa = false; };
}

export const CFG_MEDIOS = { titulo: 'Medios de pago', botonNuevo: 'Nuevo medio de pago', tabla: 'medios_pago', columnas: 'id, nombre, es_efectivo, activo',
  crearRpc: 'crear_medio_pago', editarRpc: 'editar_medio_pago', conEfectivo: true, creado: 'Medio de pago creado.',
  ayuda: 'Con qué te pagan. Solo el efectivo entra en el arqueo de caja. Desactivar uno no borra los cobros ya hechos.' };
export const CFG_CATEGORIAS = { titulo: 'Categorías de gasto', botonNuevo: 'Nueva categoría', tabla: 'categorias_gasto', columnas: 'id, nombre, activo',
  crearRpc: 'crear_categoria_gasto', editarRpc: 'editar_categoria_gasto', conEfectivo: false, creado: 'Categoría creada.',
  ayuda: 'Para ordenar los gastos (alquiler, servicios, sueldos…). Desactivar una no borra los gastos ya cargados.' };
