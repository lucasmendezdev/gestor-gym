// Ficha de un socio: datos, estado, edición, baja y reactivación.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=11';
import { estadoSocio, fecha, hoyEn } from '../formato.js?v=11';
import { campo, aviso, enviar } from '../ui.js?v=11';
import { formAviso } from './avisos.js?v=11';
import { bloqueMembresia, cargarExtra } from './ficha_membresia.js?v=11';

export function vistaFicha(contenedor, ctx, id) {
  let activa = true;
  const esDueno = ctx.perfil.rol === 'dueno';
  const zona = crear('div', { class: 'zona-ficha', 'aria-live': 'polite' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/socios', class: 'enlace-simple', id: 'volver' }, '← Volver a la búsqueda')),
    zona);
  let pendiente = ctx.flash;   // aviso que viene de otra pantalla (por ejemplo, "Socio creado")
  ctx.flash = null;
  zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));

  async function cargar() {
    try {
      const { data: s, error } = await cliente().from('socios')
        .select('id, numero, nombre, apellido, dni, telefono, observaciones, datos_informados_en, baja_en, baja_motivo')
        .eq('id', id).maybeSingle();
      if (error) throw error;
      if (!activa) return;
      const est = await rpc('estado_de_socio', { p_socio_id: id });
      if (!activa) return;
      if (!s) {
        // Recepción no puede leer la tabla de un socio dado de baja: mostramos lo mínimo.
        if (est.estado === 'baja') { pintarBajaReducida(est); return; }
        zona.replaceChildren(aviso('No se encontró el socio.')); return;
      }
      let extra = null;
      if (esDueno && !s.baja_en && est.estado !== 'sin_membresia' && est.membresia_id) extra = await cargarExtra(est.membresia_id, id);
      if (!activa) return;
      pintar(s, est, extra);
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  }

  function pintarBajaReducida(est) {
    zona.replaceChildren(
      crear('div', { class: 'cabecera-ficha' },
        crear('div', {}, crear('h2', { id: 'ficha-nombre' }, est.apellido + ', ' + est.nombre), crear('p', { class: 'suave' }, 'N.º de socio ' + est.numero)),
        crear('span', { class: 'pastilla neutro' }, 'De baja')),
      crear('div', { class: 'tarjeta', id: 'baja-reducida' },
        crear('p', {}, 'Este socio está dado de baja. Solo el dueño puede ver su ficha completa y reactivarlo.')));
  }

  function fila(et, valor) { return [crear('dt', {}, et), crear('dd', {}, valor)]; }

  function pintar(s, est, extra) {
    const hoy = hoyEn(ctx.zona);
    const e = estadoSocio(est, hoy);
    const baja = !!s.baja_en;
    const avisos = crear('div', { 'aria-live': 'polite', class: 'zona-mensajes' });
    const acciones = crear('div', { class: 'fila-botones acciones' });
    const panel = crear('div', { class: 'panel-accion' });

    const datos = crear('dl', { class: 'detalle-socio' },
      ...fila('DNI', s.dni), ...fila('Teléfono', s.telefono),
      ...fila('Observaciones', s.observaciones || '—'),
      ...fila('Datos personales', s.datos_informados_en ? 'Informado el ' + fecha(s.datos_informados_en) : 'Todavía no se le informó'));

    const mem = crear('dl', { class: 'detalle-socio' });
    if (baja) mem.append(...fila('Estado', 'De baja desde el ' + fecha(s.baja_en)), ...fila('Motivo', s.baja_motivo || '—'));

    function abrirPanel(titulo, contenido) { panel.replaceChildren(crear('h3', {}, titulo), contenido); panel.scrollIntoView({ block: 'nearest' }); }
    function cerrarPanel() { panel.replaceChildren(); }

    function formEditar() {
      const nombre = crear('input', { id: 'e-nombre', type: 'text', maxlength: '60', value: s.nombre, required: true });
      const apellido = crear('input', { id: 'e-apellido', type: 'text', maxlength: '60', value: s.apellido, required: true });
      const tel = crear('input', { id: 'e-tel', type: 'tel', inputmode: 'tel', maxlength: '20', value: s.telefono, required: true });
      const obs = crear('textarea', { id: 'e-obs', maxlength: '500', rows: '3' }); obs.value = s.observaciones || '';
      const dni = crear('input', { id: 'e-dni', type: 'text', inputmode: 'numeric', maxlength: '12', value: s.dni, disabled: !esDueno });
      const err = crear('div', { 'aria-live': 'polite' });
      const f = crear('form', { class: 'formulario', novalidate: true },
        campo('Apellido', apellido), campo('Nombre', nombre),
        campo('DNI', dni, esDueno ? 'Cambiarlo es poco frecuente: verificá que sea correcto.' : 'Solo el dueño puede cambiar el DNI.'),
        campo('Teléfono (WhatsApp)', tel, 'Con código de área, sin 0 y sin 15. Ejemplo: 2604123456.'),
        campo('Observaciones', obs), err,
        crear('div', { class: 'fila-botones' },
          crear('button', { type: 'submit', class: 'boton' }, 'Guardar cambios'),
          crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar')));
      enviar(f, err, async () => {
        const args = { p_id: id, p_nombre: nombre.value, p_apellido: apellido.value, p_telefono: tel.value, p_observaciones: obs.value.trim() };
        if (esDueno && dni.value.replace(/\D/g, '') !== s.dni) args.p_dni = dni.value;
        await rpc('editar_socio', args);
        ctx.flash = 'Datos guardados.';
        await cargar();
      });
      return f;
    }

    function formConfirmar({ boton, texto, motivo, claseBoton, accion, mensaje }) {
      const campoMotivo = motivo ? crear('textarea', { id: 'm-motivo', maxlength: '200', rows: '2', required: true }) : null;
      const err = crear('div', { 'aria-live': 'polite' });
      const f = crear('form', { class: 'formulario', novalidate: true },
        crear('p', {}, texto), campoMotivo ? campo('Motivo', campoMotivo) : null, err,
        crear('div', { class: 'fila-botones' },
          crear('button', { type: 'submit', class: 'boton ' + (claseBoton || '') }, boton),
          crear('button', { type: 'button', class: 'boton secundario', onclick: cerrarPanel }, 'Cancelar')));
      enviar(f, err, async () => { await accion(campoMotivo ? campoMotivo.value : null); ctx.flash = mensaje; await cargar(); });
      return f;
    }

    let tarjetaMem = crear('div', { class: 'tarjeta' }, crear('h3', {}, 'Membresía'), mem);
    if (!baja) {
      const b = bloqueMembresia({ ctx, id, est, extra, esDueno, abrirPanel, cerrarPanel, formConfirmar, recargar: cargar });
      tarjetaMem = b.tarjeta;
      acciones.append(...b.botones);
    }
    if (!baja && est.estado !== 'sin_membresia') {
      acciones.append(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-bienvenida', onclick: () => {
        const f = formAviso({ ctx, socioId: id, nombre: s.apellido + ', ' + s.nombre, tipo: 'bienvenida', cerrar: cerrarPanel,
          alRegistrar: async () => { ctx.flash = 'Bienvenida registrada.'; await cargar(); } });
        abrirPanel('Aviso de bienvenida', f);
      } }, 'Enviar bienvenida'));
    }
    acciones.append(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-editar', onclick: () => abrirPanel('Editar datos', formEditar()) }, 'Editar datos'));
    if (esDueno && !baja) {
      acciones.append(crear('button', { type: 'button', class: 'boton secundario chico peligro', id: 'btn-baja', onclick: () => abrirPanel('Dar de baja',
        formConfirmar({ boton: 'Confirmar baja', claseBoton: 'peligro', motivo: true,
          texto: 'El socio deja de figurar como activo y se cierra su membresía. Nada se borra: se puede reactivar.',
          accion: (m) => rpc('dar_de_baja_socio', { p_id: id, p_motivo: m }), mensaje: 'El socio fue dado de baja.' })) }, 'Dar de baja'));
    }
    if (esDueno && baja) {
      acciones.append(crear('button', { type: 'button', class: 'boton chico', id: 'btn-reactivar', onclick: () => abrirPanel('Reactivar socio',
        formConfirmar({ boton: 'Reactivar', texto: 'El socio vuelve a estar activo. Su membresía anterior no se reabre: hay que crear una nueva.',
          accion: () => rpc('reactivar_socio', { p_id: id }), mensaje: 'El socio fue reactivado.' })) }, 'Reactivar'));
    }
    if (esDueno && !s.datos_informados_en) {
      acciones.append(crear('button', { type: 'button', class: 'boton secundario chico', id: 'btn-informado', onclick: () => abrirPanel('Datos personales',
        formConfirmar({ boton: 'Registrar', texto: 'Registrá que le informaste al socio cómo se usan sus datos personales.',
          accion: () => rpc('registrar_datos_informados', { p_id: id }), mensaje: 'Quedó registrado que se le informó.' })) }, 'Registrar datos informados'));
    }

    const mensajes = crear('div', { class: 'zona-mensajes' });
    if (ctx.flash || pendiente) { mensajes.append(aviso(ctx.flash || pendiente, 'ok')); ctx.flash = null; pendiente = null; }
    zona.replaceChildren(
      mensajes,
      crear('div', { class: 'cabecera-ficha' },
        crear('div', {}, crear('h2', { id: 'ficha-nombre' }, s.apellido + ', ' + s.nombre),
          crear('p', { class: 'suave' }, 'N.º de socio ' + s.numero)),
        crear('span', { class: 'pastilla ' + (baja ? 'neutro' : e.clase) }, baja ? 'De baja' : e.texto)),
      baja ? null : crear('p', { class: 'suave', id: 'ficha-detalle' }, e.detalle),
      crear('div', { class: 'tarjeta' }, crear('h3', {}, 'Datos'), datos),
      tarjetaMem,
      acciones, panel);
  }

  cargar();
  return () => { activa = false; };
}
