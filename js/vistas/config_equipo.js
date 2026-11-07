// Configuración · Equipo e invitaciones (solo dueño).
import { crear, cliente, rpc, traducirError } from '../comun.js?v=13';
import { aviso, enviar, flash } from '../ui.js?v=13';
import { fechaHora } from '../formato.js?v=13';

export function vistaEquipo(contenedor, ctx) {
  let activa = true;
  let perfiles = [];
  const zU = crear('div', { 'aria-live': 'polite', id: 'zona-usuarios' });
  const zI = crear('div', { 'aria-live': 'polite', id: 'zona-invitaciones' });
  const panel = crear('div', { class: 'panel-accion', id: 'panel-invitacion' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Equipo e invitaciones')),
    mensajes,
    crear('h3', {}, 'Personas con acceso'), zU,
    crear('div', { class: 'cabecera-vista' }, crear('h3', {}, 'Invitaciones'),
      crear('button', { type: 'button', class: 'boton chico', id: 'btn-invitar', onclick: generar }, 'Generar invitación')),
    crear('p', { class: 'suave' }, 'Para sumar a alguien de recepción: primero se le crea el usuario (correo y contraseña) en Supabase, en Authentication → Users. Al ingresar por primera vez, el sistema le pide el código de invitación.'),
    panel, zI);
  flash(ctx, mensajes);

  async function cambiar(p, rpcNombre, texto) {
    mensajes.replaceChildren();
    try { await rpc(rpcNombre, { p_id: p.id }); ctx.flash = texto; flash(ctx, mensajes); await cargarU(); }
    catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
  }

  async function generar() {
    mensajes.replaceChildren(); panel.replaceChildren();
    const boton = document.getElementById('btn-invitar'); if (boton) boton.disabled = true;
    try {
      const r = await rpc('generar_invitacion');
      if (!activa) return;
      const copia = crear('span', { 'aria-live': 'polite', id: 'copia-res', class: 'suave' });
      panel.replaceChildren(crear('h3', {}, 'Código de invitación'),
        crear('p', { class: 'codigo-invitacion', id: 'codigo-invitacion' }, r.codigo),
        crear('p', {}, 'Vale hasta el ' + fechaHora(r.vence_en, ctx.zona) + '. Solo se muestra ahora: si lo perdés, anulá esta invitación y generá otra.'),
        crear('div', { class: 'fila-botones' },
          crear('button', { type: 'button', class: 'boton chico', id: 'btn-copiar', onclick: async () => {
            try { await navigator.clipboard.writeText(r.codigo); copia.textContent = 'Copiado.'; } catch (_) { copia.textContent = 'No se pudo copiar: escribilo a mano.'; }
          } }, 'Copiar código'),
          crear('button', { type: 'button', class: 'boton secundario chico', onclick: () => panel.replaceChildren() }, 'Cerrar'), copia));
      await cargarI();
    } catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
    finally { if (boton) boton.disabled = false; }
  }

  async function anular(i) {
    mensajes.replaceChildren();
    try { await rpc('anular_invitacion', { p_id: i.id }); ctx.flash = 'Invitación anulada.'; flash(ctx, mensajes); panel.replaceChildren(); await cargarI(); }
    catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
  }

  async function cargarU() {
    try {
      const { data, error } = await cliente().from('perfiles').select('id, rol, nombre, activo, creado_en').order('activo', { ascending: false }).order('nombre');
      if (error) throw error;
      if (!activa) return;
      perfiles = data;
      zU.replaceChildren(crear('ul', { class: 'lista-planes', id: 'lista-usuarios' }, data.map((p) => {
        const yo = p.id === ctx.perfil.id, dueno = p.rol === 'dueno';
        return crear('li', { class: 'plan-item', 'data-usuario': p.id },
          crear('div', { class: 'plan-info' }, crear('strong', {}, p.nombre + (yo ? ' (vos)' : '')), crear('span', { class: 'suave' }, (dueno ? 'Dueño' : 'Recepción') + ' · desde ' + fechaHora(p.creado_en, ctx.zona).split(' ')[0])),
          crear('span', { class: 'pastilla ' + (p.activo ? 'ok' : 'neutro') }, p.activo ? 'Activo' : 'Desactivado'),
          dueno || yo ? null : crear('div', { class: 'fila-botones' }, p.activo
            ? crear('button', { type: 'button', class: 'boton secundario chico peligro', 'data-desactivar': p.id, onclick: () => cambiar(p, 'desactivar_usuario', 'Usuario desactivado: ya no puede ingresar.') }, 'Desactivar')
            : crear('button', { type: 'button', class: 'boton secundario chico', 'data-reactivar': p.id, onclick: () => cambiar(p, 'reactivar_usuario', 'Usuario reactivado.') }, 'Reactivar')));
      })));
      await cargarI();
    } catch (e) { if (activa) zU.replaceChildren(aviso(traducirError(e))); }
  }

  const estadoInv = (i) => {
    if (i.usada_en) return { t: 'Usada', c: 'frio' };
    if (i.anulada_en) return { t: 'Anulada', c: 'neutro' };
    if (new Date(i.vence_en) <= new Date()) return { t: 'Vencida', c: 'neutro' };
    return { t: 'Pendiente', c: 'ok' };
  };
  async function cargarI() {
    try {
      const { data, error } = await cliente().from('invitaciones').select('id, creada_en, vence_en, usada_por, usada_en, anulada_en').order('creada_en', { ascending: false }).limit(20);
      if (error) throw error;
      if (!activa) return;
      zI.replaceChildren(!data.length ? crear('p', { class: 'suave', id: 'sin-invitaciones' }, 'Todavía no generaste invitaciones.')
        : crear('ul', { class: 'lista-planes', id: 'lista-invitaciones' }, data.map((i) => {
          const e = estadoInv(i), quien = i.usada_por ? perfiles.find((p) => p.id === i.usada_por) : null;
          return crear('li', { class: 'plan-item', 'data-invitacion': i.id },
            crear('div', { class: 'plan-info' }, crear('strong', {}, 'Creada el ' + fechaHora(i.creada_en, ctx.zona)),
              crear('span', { class: 'suave' }, i.usada_en ? 'Usada por ' + (quien ? quien.nombre : 'un usuario') : 'Vence el ' + fechaHora(i.vence_en, ctx.zona))),
            crear('span', { class: 'pastilla ' + e.c }, e.t),
            e.t === 'Pendiente' ? crear('div', { class: 'fila-botones' }, crear('button', { type: 'button', class: 'boton secundario chico peligro', 'data-anular-inv': i.id, onclick: () => anular(i) }, 'Anular')) : null);
        })));
    } catch (e) { if (activa) zI.replaceChildren(aviso(traducirError(e))); }
  }
  cargarU();
  return () => { activa = false; };
}
