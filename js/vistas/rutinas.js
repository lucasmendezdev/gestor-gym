// Rutinas (solo Plan Full). Rutas:
//   #/rutinas                       lista de rutinas (el dueño además las administra)
//   #/rutinas/ejercicios            catálogo de ejercicios (dueño)
//   #/rutinas/nueva · #/rutinas/editar/<id>   editor (dueño)
//   #/rutinas/ver/<id>              ver una plantilla
//   #/rutinas/asignacion/<id>       lo que recibió un socio (ver, imprimir, WhatsApp)
import { crear, cliente, rpc, traducirError } from '../comun.js?v=17';
import { aviso, enviar, campo, flash, esUuid } from '../ui.js?v=17';
import { vistaEjercicios } from './rutinas_ejercicios.js?v=17';
import { vistaEditor } from './rutinas_editor.js?v=17';
import { vistaAsignacion } from './rutina_asignada.js?v=17';
import { dibujarContenido, resumenDias, cabeceraImpresion } from './rutinas_comun.js?v=17';

export function vistaRutinas(contenedor, ctx, params) {
  const esDueno = ctx.perfil.rol === 'dueno';
  const [sub, id] = params || [];
  if (sub === 'ejercicios' && esDueno) return vistaEjercicios(contenedor, ctx);
  if ((sub === 'nueva' || sub === 'editar') && esDueno) return vistaEditor(contenedor, ctx, sub === 'editar' ? id : null);
  if (sub === 'ver') return vistaVer(contenedor, ctx, id);
  if (sub === 'asignacion') return vistaAsignacion(contenedor, ctx, id);
  return vistaLista(contenedor, ctx, esDueno);
}

function vistaLista(contenedor, ctx, esDueno) {
  let activa = true;
  const zona = crear('div', { id: 'zona-rutinas', 'aria-live': 'polite' });
  const panel = crear('div', { class: 'panel-accion' });
  const mensajes = crear('div', { class: 'zona-mensajes', 'aria-live': 'polite' });
  contenedor.replaceChildren(
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Rutinas'),
      esDueno ? crear('div', { class: 'fila-botones' },
        crear('a', { href: '#/rutinas/nueva', class: 'boton chico enlace-boton', id: 'btn-nueva-rutina' }, 'Nueva rutina'),
        crear('a', { href: '#/rutinas/ejercicios', class: 'boton secundario chico enlace-boton', id: 'btn-ejercicios' }, 'Ejercicios')) : null),
    crear('p', { class: 'suave' }, esDueno
      ? 'Las rutinas son plantillas. Se asignan a cada socio desde su ficha y cada socio recibe una copia: si después editás la rutina, lo que ya se entregó no cambia.'
      : 'Rutinas disponibles. Para asignar una, entrá a la ficha del socio.'),
    mensajes, panel, zona);
  flash(ctx, mensajes);
  const cerrar = () => panel.replaceChildren();

  async function listo(texto) { ctx.flash = texto; cerrar(); mensajes.replaceChildren(); flash(ctx, mensajes); await cargar(); }

  function formDuplicar(r) {
    const nombre = crear('input', { id: 'dup-nombre', type: 'text', maxlength: '60', required: true, value: r.nombre + ' (copia)' });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true }, campo('Nombre de la copia', nombre), err,
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton' }, 'Duplicar'),
        crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cancelar')));
    panel.replaceChildren(crear('h3', {}, 'Duplicar «' + r.nombre + '»'), f);
    enviar(f, err, async () => { await rpc('duplicar_rutina', { p_id: r.id, p_nombre: nombre.value }); await listo('Rutina duplicada.'); });
  }

  async function alternar(r) {
    mensajes.replaceChildren();
    try { await rpc('editar_rutina', { p_id: r.id, p_activa: !r.activa }); await listo(r.activa ? 'Rutina archivada.' : 'Rutina activada.'); }
    catch (e) { mensajes.replaceChildren(aviso(traducirError(e))); }
  }

  async function cargar() {
    try {
      const { data, error } = await cliente().from('rutinas').select('id, nombre, objetivo, version, activa, dias').order('activa', { ascending: false }).order('nombre');
      if (error) throw error;
      if (!activa) return;
      zona.replaceChildren(!data.length
        ? crear('div', { class: 'tarjeta vacia', id: 'rutinas-vacio' }, crear('p', {}, esDueno ? 'Todavía no hay rutinas. Cargá primero los ejercicios y después creá la primera rutina.' : 'Todavía no hay rutinas.'))
        : crear('ul', { class: 'lista-planes', id: 'lista-rutinas' }, data.map((r) => crear('li', { class: 'plan-item', 'data-rutina': r.id },
          crear('div', { class: 'plan-info' }, crear('strong', {}, r.nombre), r.objetivo ? crear('span', { class: 'suave' }, r.objetivo) : null,
            crear('span', { class: 'suave' }, 'Versión ' + r.version + ' · ' + resumenDias(r.dias))),
          esDueno ? crear('span', { class: 'pastilla ' + (r.activa ? 'ok' : 'neutro') }, r.activa ? 'Activa' : 'Archivada') : null,
          crear('div', { class: 'fila-botones' },
            crear('a', { href: '#/rutinas/ver/' + r.id, class: 'boton secundario chico enlace-boton', 'data-ver': r.id }, 'Ver'),
            esDueno ? [
              crear('a', { href: '#/rutinas/editar/' + r.id, class: 'boton secundario chico enlace-boton', 'data-editar': r.id }, 'Editar'),
              crear('button', { type: 'button', class: 'boton secundario chico', 'data-duplicar': r.id, onclick: () => formDuplicar(r) }, 'Duplicar'),
              crear('button', { type: 'button', class: 'boton secundario chico', 'data-alternar': r.id, onclick: () => alternar(r) }, r.activa ? 'Archivar' : 'Activar')] : null)))));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }
  cargar();
  return () => { activa = false; };
}

function vistaVer(contenedor, ctx, id) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  contenedor.replaceChildren(crear('p', { class: 'no-imprimir' }, crear('a', { href: '#/rutinas', class: 'enlace-simple' }, '← Volver a Rutinas')), zona);
  zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));
  (async () => {
    try {
      if (!esUuid(id)) throw new Error('La rutina no existe.');
      const { data: r, error } = await cliente().from('rutinas').select('id, nombre, objetivo, notas, dias, version, activa').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!activa) return;
      if (!r) { zona.replaceChildren(aviso('No se encontró la rutina.')); return; }
      zona.replaceChildren(
        cabeceraImpresion(ctx, 'Rutina: ' + r.nombre),
        crear('div', { class: 'cabecera-ficha' }, crear('div', {}, crear('h2', { id: 'rutina-titulo' }, r.nombre), crear('p', { class: 'suave' }, 'Versión ' + r.version + ' · ' + resumenDias(r.dias))),
          crear('span', { class: 'pastilla ' + (r.activa ? 'ok' : 'neutro') + ' no-imprimir' }, r.activa ? 'Activa' : 'Archivada')),
        dibujarContenido(r),
        crear('div', { class: 'fila-botones no-imprimir' },
          crear('button', { type: 'button', class: 'boton secundario', id: 'btn-imprimir', onclick: () => window.print() }, 'Imprimir')));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();
  return () => { activa = false; };
}
