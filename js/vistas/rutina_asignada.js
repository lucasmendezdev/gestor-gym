// Rutinas · detalle de lo que recibió un socio: ver, imprimir y mandar por WhatsApp.
import { crear, cliente, traducirError } from '../comun.js?v=17';
import { fecha } from '../formato.js?v=17';
import { aviso, esUuid } from '../ui.js?v=17';
import { dibujarContenido, resumenDias, textoRutina, panelCompartir, cabeceraImpresion } from './rutinas_comun.js?v=17';

export const MOTIVOS = { reemplazada: 'Reemplazada por otra rutina', manual: 'Finalizada', membresia_cerrada: 'Se cerró la membresía', baja: 'El socio fue dado de baja' };

export function vistaAsignacion(contenedor, ctx, id) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  const panel = crear('div', { class: 'panel-accion no-imprimir' });
  contenedor.replaceChildren(zona, panel);
  zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));

  (async () => {
    try {
      if (!esUuid(id)) throw new Error('La rutina asignada no existe.');
      const { data: a, error } = await cliente().from('asignaciones_rutina')
        .select('id, socio_id, rutina_nombre, rutina_version, contenido, fecha_desde, fecha_hasta, estado, nota, finalizada_motivo, finalizada_nota').eq('id', id).maybeSingle();
      if (error) throw error;
      if (!a) { if (activa) zona.replaceChildren(aviso('No se encontró la rutina asignada.')); return; }
      const rs = await cliente().from('socios').select('id, numero, nombre, apellido, telefono').eq('id', a.socio_id).maybeSingle();
      if (rs.error) throw rs.error;
      if (!activa) return;
      const s = rs.data;
      if (!s) { zona.replaceChildren(aviso('No se encontró la rutina asignada.')); return; }
      const nombreSocio = s.apellido + ', ' + s.nombre;
      const texto = textoRutina({ gimnasio: ctx.negocio, socio: s.nombre + ' ' + s.apellido, rutina: a.rutina_nombre, version: a.rutina_version, desde: a.fecha_desde, nota: a.nota, contenido: a.contenido });
      const vigente = a.estado === 'activa';
      zona.replaceChildren(
        crear('p', { class: 'no-imprimir' }, crear('a', { href: '#/socios/' + s.id, class: 'enlace-simple', id: 'volver-ficha' }, '← Volver a la ficha de ' + nombreSocio)),
        cabeceraImpresion(ctx, 'Rutina de ' + nombreSocio + ' (socio N.º ' + s.numero + ')'),
        crear('div', { class: 'cabecera-ficha' },
          crear('div', {}, crear('h2', { id: 'asig-titulo' }, a.rutina_nombre),
            crear('p', { class: 'suave' }, nombreSocio + ' · Versión ' + a.rutina_version + ' · ' + resumenDias(a.contenido.dias))),
          crear('span', { class: 'pastilla no-imprimir ' + (vigente ? 'ok' : 'neutro') }, vigente ? 'Vigente' : 'Finalizada')),
        crear('p', { class: 'suave', id: 'asig-fechas' }, 'Desde el ' + fecha(a.fecha_desde) + (a.fecha_hasta ? ' hasta el ' + fecha(a.fecha_hasta) : '') +
          (!vigente && a.finalizada_motivo ? ' · ' + (MOTIVOS[a.finalizada_motivo] || '') + (a.finalizada_nota ? ': ' + a.finalizada_nota : '') : '')),
        a.nota ? crear('p', { class: 'rutina-indicaciones', id: 'asig-nota' }, crear('strong', {}, 'Indicaciones: '), a.nota) : null,
        dibujarContenido(a.contenido),
        crear('div', { class: 'fila-botones no-imprimir' },
          crear('button', { type: 'button', class: 'boton secundario', id: 'btn-imprimir', onclick: () => window.print() }, 'Imprimir'),
          crear('button', { type: 'button', class: 'boton', id: 'btn-whatsapp', onclick: () => {
            panel.replaceChildren(crear('h3', {}, 'Enviar a ' + s.nombre), panelCompartir({ ctx, telefono: s.telefono, texto, cerrar: () => panel.replaceChildren() }));
          } }, 'Enviar por WhatsApp')));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();
  return () => { activa = false; };
}
