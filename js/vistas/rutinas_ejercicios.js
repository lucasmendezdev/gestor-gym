// Rutinas · catálogo de ejercicios (solo dueño). Los ejercicios se archivan, no se borran.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=17';
import { campo, aviso, enviar, flash } from '../ui.js?v=17';

export function vistaEjercicios(contenedor, ctx) {
  let activa = true;
  let todos = [];
  const zona = crear('div', { id: 'zona-ejercicios', 'aria-live': 'polite' });
  const panel = crear('div', { class: 'panel-accion' });
  const mensajes = crear('div', { class: 'zona-mensajes', 'aria-live': 'polite' });
  const buscar = crear('input', { id: 'ej-buscar', type: 'search', placeholder: 'Buscar ejercicio o grupo muscular', 'aria-label': 'Buscar ejercicio' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/rutinas', class: 'enlace-simple' }, '← Volver a Rutinas')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Ejercicios'),
      crear('button', { type: 'button', class: 'boton chico', id: 'btn-nuevo-ej', onclick: () => form(null) }, 'Nuevo ejercicio')),
    crear('p', { class: 'suave' }, 'Lista de ejercicios del gimnasio. Si cambiás un nombre, las rutinas ya guardadas conservan el nombre con que se armaron hasta que las edites.'),
    mensajes, panel, crear('div', { class: 'campo' }, buscar), zona);
  flash(ctx, mensajes);
  const cerrar = () => panel.replaceChildren();
  async function listo(t) { ctx.flash = t; cerrar(); mensajes.replaceChildren(); flash(ctx, mensajes); await cargar(); }

  function form(e) {
    const nombre = crear('input', { id: 'ej-nombre', type: 'text', maxlength: '60', required: true, value: e ? e.nombre : '' });
    const grupo = crear('input', { id: 'ej-grupo', type: 'text', maxlength: '40', value: e && e.grupo_muscular ? e.grupo_muscular : '' });
    const notas = crear('textarea', { id: 'ej-notas', rows: '2', maxlength: '300' }); notas.value = e && e.notas ? e.notas : '';
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario', novalidate: true },
      campo('Nombre', nombre), campo('Grupo muscular (opcional)', grupo, 'Por ejemplo: Piernas, Pecho, Espalda.'), campo('Nota (opcional)', notas, 'Una indicación técnica que quieras recordar.'), err,
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton' }, e ? 'Guardar' : 'Crear'),
        crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cancelar')));
    panel.replaceChildren(crear('h3', {}, e ? 'Editar ejercicio' : 'Nuevo ejercicio'), f);
    nombre.focus();
    enviar(f, err, async () => {
      if (e) { await rpc('editar_ejercicio', { p_id: e.id, p_nombre: nombre.value, p_grupo_muscular: grupo.value.trim(), p_notas: notas.value.trim() }); await listo('Ejercicio guardado.'); }
      else { await rpc('crear_ejercicio', { p_nombre: nombre.value, p_grupo_muscular: grupo.value, p_notas: notas.value }); await listo('Ejercicio creado.'); }
    });
  }

  async function alternar(e) {
    mensajes.replaceChildren();
    try { await rpc('editar_ejercicio', { p_id: e.id, p_activo: !e.activo }); await listo(e.activo ? 'Ejercicio archivado.' : 'Ejercicio activado.'); }
    catch (x) { mensajes.replaceChildren(aviso(traducirError(x))); }
  }

  function pintar() {
    const q = buscar.value.trim().toLowerCase();
    const lista = todos.filter((e) => !q || e.nombre.toLowerCase().includes(q) || (e.grupo_muscular || '').toLowerCase().includes(q));
    zona.replaceChildren(!todos.length
      ? crear('div', { class: 'tarjeta vacia', id: 'ejercicios-vacio' }, crear('p', {}, 'Todavía no hay ejercicios. Creá el primero con "Nuevo ejercicio".'))
      : !lista.length ? crear('p', { class: 'suave', id: 'ejercicios-sin-resultados' }, 'Ningún ejercicio coincide con la búsqueda.')
      : crear('ul', { class: 'lista-planes', id: 'lista-ejercicios' }, lista.map((e) => crear('li', { class: 'plan-item', 'data-ejercicio': e.id },
        crear('div', { class: 'plan-info' }, crear('strong', {}, e.nombre), e.grupo_muscular ? crear('span', { class: 'suave' }, e.grupo_muscular) : null, e.notas ? crear('span', { class: 'suave' }, e.notas) : null),
        crear('span', { class: 'pastilla ' + (e.activo ? 'ok' : 'neutro') }, e.activo ? 'Activo' : 'Archivado'),
        crear('div', { class: 'fila-botones' },
          crear('button', { type: 'button', class: 'boton secundario chico', 'data-editar-ej': e.id, onclick: () => form(e) }, 'Editar'),
          crear('button', { type: 'button', class: 'boton secundario chico', 'data-alternar-ej': e.id, onclick: () => alternar(e) }, e.activo ? 'Archivar' : 'Activar'))))));
  }
  buscar.addEventListener('input', pintar);

  async function cargar() {
    try {
      const { data, error } = await cliente().from('ejercicios').select('id, nombre, grupo_muscular, notas, activo').order('activo', { ascending: false }).order('nombre');
      if (error) throw error;
      if (!activa) return;
      todos = data; pintar();
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }
  cargar();
  return () => { activa = false; };
}
