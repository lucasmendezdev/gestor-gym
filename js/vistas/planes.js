// Planes (solo dueño): versión mínima. Se completa en la Etapa 8.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=16';
import { moneda } from '../formato.js?v=16';
import { campo, aviso, enviar, flash } from '../ui.js?v=16';

export function vistaPlanes(contenedor, ctx) {
  let activa = true;
  const zona = crear('div', { class: 'zona-planes', 'aria-live': 'polite' });
  const panel = crear('div', { class: 'panel-accion' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Planes'),
      crear('button', { type: 'button', class: 'boton chico', id: 'btn-nuevo-plan', onclick: () => abrir(null) }, 'Nuevo plan')),
    mensajes, panel, zona);
  flash(ctx, mensajes);

  function cerrar() { panel.replaceChildren(); }

  function abrir(p) {
    const nombre = crear('input', { id: 'p-nombre', type: 'text', maxlength: '40', required: true, value: p ? p.nombre : '' });
    const pers = crear('input', { id: 'p-pers', type: 'checkbox', disabled: !!p }); pers.checked = !!(p && p.personalizado);
    const dias = crear('select', { id: 'p-dias' },
      crear('option', { value: '0' }, 'Sin tope semanal'),
      ...[1, 2, 3, 4, 5, 6, 7].map((n) => crear('option', { value: String(n) }, n + (n === 1 ? ' día por semana' : ' días por semana'))));
    dias.value = p && p.dias_por_semana ? String(p.dias_por_semana) : '0';
    const precio = crear('input', { id: 'p-precio', type: 'text', inputmode: 'decimal', required: true, value: p ? String(p.precio_mensual).replace('.', ',') : '' });
    const activo = crear('input', { id: 'p-activo', type: 'checkbox' }); activo.checked = p ? p.activo : true;
    const err = crear('div', { 'aria-live': 'polite' });
    function sincronizar() { dias.disabled = pers.checked; if (pers.checked) dias.value = '0'; }
    pers.addEventListener('change', sincronizar); sincronizar();
    const f = crear('form', { class: 'tarjeta formulario', novalidate: true },
      crear('h3', {}, p ? 'Editar plan' : 'Nuevo plan'),
      campo('Nombre del plan', nombre),
      crear('div', { class: 'campo casilla' }, pers, crear('label', { for: 'p-pers' }, 'Plan personalizado (los días y el precio se definen en cada membresía)')),
      campo('Días por semana', dias),
      campo('Precio mensual ($)', precio, 'Un plan activo necesita un precio mayor a 0. En uno personalizado puede quedar en 0.'),
      crear('div', { class: 'campo casilla' }, activo, crear('label', { for: 'p-activo' }, 'Plan activo (se puede elegir al crear membresías)')),
      err,
      crear('div', { class: 'fila-botones' },
        crear('button', { type: 'submit', class: 'boton' }, p ? 'Guardar cambios' : 'Crear plan'),
        crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cancelar')));
    panel.replaceChildren(f);
    nombre.focus({ preventScroll: true });
    enviar(f, err, async () => {
      const raw = precio.value.trim().replace(/\./g, '').replace(',', '.');
      const monto = raw === '' ? (pers.checked ? 0 : NaN) : Number(raw);
      if (!Number.isFinite(monto)) throw new Error('Escribí el precio mensual (solo números, por ejemplo 15000).');
      if (p) {
        await rpc('editar_plan', { p_id: p.id, p_nombre: nombre.value, p_dias_por_semana: Number(dias.value), p_precio_mensual: monto, p_activo: activo.checked });
        ctx.flash = 'Plan guardado.';
      } else {
        await rpc('crear_plan', { p_nombre: nombre.value, p_dias_por_semana: pers.checked || dias.value === '0' ? null : Number(dias.value),
          p_precio_mensual: monto, p_personalizado: pers.checked, p_activo: activo.checked });
        ctx.flash = 'Plan creado.';
      }
      cerrar(); mensajes.replaceChildren(); flash(ctx, mensajes); await cargar();
    });
  }

  async function alternar(p) {
    mensajes.replaceChildren();
    try {
      await rpc('editar_plan', { p_id: p.id, p_activo: !p.activo });
      ctx.flash = p.activo ? 'Plan desactivado.' : 'Plan activado.';
      flash(ctx, mensajes); await cargar();
    } catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
  }

  async function cargar() {
    try {
      const { data, error } = await cliente().from('planes')
        .select('id, nombre, dias_por_semana, precio_mensual, personalizado, activo').order('activo', { ascending: false }).order('nombre');
      if (error) throw error;
      if (!activa) return;
      if (!data.length) { zona.replaceChildren(crear('p', { class: 'suave' }, 'Todavía no hay planes. Creá el primero con "Nuevo plan".')); return; }
      zona.replaceChildren(crear('ul', { class: 'lista-planes' }, data.map((p) => crear('li', { class: 'plan-item', 'data-plan': p.id },
        crear('div', { class: 'plan-info' },
          crear('strong', {}, p.nombre),
          crear('span', { class: 'suave' }, p.personalizado ? 'Personalizado: días y precio en cada membresía'
            : (p.dias_por_semana ? p.dias_por_semana + ' días por semana' : 'Sin tope semanal') + ' · ' + moneda(p.precio_mensual) + ' por mes')),
        crear('span', { class: 'pastilla ' + (p.activo ? 'ok' : 'neutro') }, p.activo ? 'Activo' : 'Inactivo'),
        crear('div', { class: 'fila-botones' },
          crear('button', { type: 'button', class: 'boton secundario chico', 'data-editar': p.id, onclick: () => abrir(p) }, 'Editar'),
          crear('button', { type: 'button', class: 'boton secundario chico', 'data-alternar': p.id, onclick: () => alternar(p) }, p.activo ? 'Desactivar' : 'Activar'))))));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }
  cargar();
  return () => { activa = false; };
}
