// Configuración · Datos del negocio (solo dueño): nombre, zona horaria, prefijo de WhatsApp y días de aviso.
import { crear, cliente, rpc, traducirError, aplicarMarca } from '../comun.js?v=10';
import { campo, aviso, enviar, flash } from '../ui.js?v=10';

const ZONAS = ['America/Argentina/Buenos_Aires', 'America/Argentina/Cordoba', 'America/Argentina/Mendoza', 'America/Argentina/Salta',
  'America/Argentina/Tucuman', 'America/Argentina/Ushuaia', 'America/Montevideo', 'America/Santiago', 'America/Asuncion'];

export function vistaNegocio(contenedor, ctx) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Datos del negocio')),
    mensajes, zona);
  flash(ctx, mensajes);

  function formulario(n) {
    const nombre = crear('input', { id: 'n-nombre', type: 'text', maxlength: '80', required: true, value: n.nombre });
    const tz = crear('input', { id: 'n-zona', type: 'text', list: 'lista-zonas', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', required: true, value: n.zona_horaria });
    const lista = crear('datalist', { id: 'lista-zonas' }, ZONAS.map((z) => crear('option', { value: z })));
    const pref = crear('input', { id: 'n-prefijo', type: 'text', inputmode: 'numeric', maxlength: '4', required: true, value: n.prefijo_whatsapp });
    const dias = crear('input', { id: 'n-dias', type: 'text', inputmode: 'numeric', maxlength: '2', required: true, value: String(n.aviso_vencimiento_dias) });
    const err = crear('div', { 'aria-live': 'polite' });
    const f = crear('form', { class: 'formulario tarjeta', novalidate: true },
      campo('Nombre del gimnasio', nombre),
      campo('Zona horaria', tz, 'Define cuándo empieza y termina cada día (caja, asistencia, vencimientos). Cambiala solo si el gimnasio está en otra zona.'), lista,
      campo('Prefijo de WhatsApp', pref, 'Se agrega al teléfono de los socios al armar el enlace. Argentina: 549.'),
      campo('Días de aviso antes del vencimiento', dias, 'Cuántos días antes de vencer aparece un socio en "Por vencer" (de 0 a 30).'),
      err,
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', id: 'n-guardar' }, 'Guardar')));
    enviar(f, err, async () => {
      const d = dias.value.trim();
      if (!/^[0-9]{1,2}$/.test(d)) throw new Error('Los días de aviso deben ser un número entero de 0 a 30.');
      const r = await rpc('editar_negocio', { p_nombre: nombre.value, p_zona_horaria: tz.value.trim(), p_prefijo_whatsapp: pref.value.trim(), p_aviso_vencimiento_dias: Number(d) });
      ctx.negocio = r.nombre; ctx.zona = r.zona_horaria; ctx.prefijo = r.prefijo_whatsapp; ctx.diasAviso = r.aviso_vencimiento_dias;
      aplicarMarca(r.nombre);
      ctx.flash = 'Datos guardados.';
      mensajes.replaceChildren(); flash(ctx, mensajes);
      nombre.value = r.nombre; tz.value = r.zona_horaria; pref.value = r.prefijo_whatsapp; dias.value = String(r.aviso_vencimiento_dias);
    });
    return f;
  }

  (async () => {
    try {
      const { data, error } = await cliente().from('negocio').select('nombre, zona_horaria, prefijo_whatsapp, aviso_vencimiento_dias').limit(1).maybeSingle();
      if (error) throw error;
      if (!activa) return;
      if (!data) { zona.replaceChildren(aviso('Todavía no hay un negocio creado.')); return; }
      zona.replaceChildren(formulario(data));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();
  return () => { activa = false; };
}
