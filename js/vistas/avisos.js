// Avisos por WhatsApp (Etapa 8). Rutas: #/avisos (por vencer) · #/avisos/mora (en mora).
// El sistema prepara el mensaje y abre WhatsApp; el aviso se registra recién cuando la persona
// toca "Ya lo envié". No muestra importes. La bienvenida se manda desde la ficha del socio.
import { crear, rpc, traducirError, enLinea } from '../comun.js?v=13';
import { fecha, fechaHora, hoyEn, diasEntre, plural } from '../formato.js?v=13';
import { aviso, enviar } from '../ui.js?v=13';

const TIPOS = {
  vencimiento: { pestana: 'Por vencer', ruta: '#/avisos', titulo: 'Aviso de vencimiento' },
  mora: { pestana: 'En mora', ruta: '#/avisos/mora', titulo: 'Aviso de mora' },
  bienvenida: { pestana: 'Bienvenida', ruta: '', titulo: 'Aviso de bienvenida' },
};
const enlaceSeguro = (u) => typeof u === 'string' && /^https:\/\/wa\.me\/[0-9]{8,20}\?text=/.test(u);

// Formulario de un aviso: prepara el mensaje, abre WhatsApp y registra con "Ya lo envié".
// Lo usan esta pantalla y la ficha del socio (bienvenida).
export function formAviso({ ctx, socioId, nombre, tipo, alRegistrar, cerrar }) {
  const cont = crear('div', { class: 'formulario', id: 'form-aviso', 'data-tipo': tipo });
  const err = crear('div', { 'aria-live': 'polite' });
  cont.append(crear('p', { class: 'suave' }, 'Preparando el mensaje…'));
  let activo = true;

  (async () => {
    if (!enLinea()) { cont.replaceChildren(aviso('Sin conexión a internet. No se puede preparar el aviso hasta que vuelva.'), botonCerrar()); return; }
    let p;
    try { p = await rpc('preparar_aviso', { p_socio_id: socioId, p_tipo: tipo }); }
    catch (e) { if (activo) cont.replaceChildren(aviso(traducirError(e)), botonCerrar()); return; }
    if (!activo) return;
    if (!enlaceSeguro(p.enlace)) { cont.replaceChildren(aviso('No se pudo armar el enlace de WhatsApp para este socio. Revisá su teléfono en la ficha.'), botonCerrar()); return; }

    const texto = crear('textarea', { id: 'aviso-mensaje', rows: '4', readonly: true, 'aria-label': 'Mensaje que se va a enviar' });
    texto.value = p.mensaje;
    let abierto = false;
    const registrar = crear('button', { type: 'submit', class: 'boton secundario', id: 'aviso-registrar', disabled: true }, 'Ya lo envié');
    const abrir = crear('a', { href: p.enlace, target: '_blank', rel: 'noopener noreferrer', class: 'boton enlace-boton', id: 'aviso-abrir',
      onclick: () => { abierto = true; registrar.disabled = false; registrar.classList.remove('secundario'); abrir.classList.add('secundario'); ayuda.textContent = 'Cuando lo hayas enviado, tocá "Ya lo envié" para dejarlo registrado.'; } }, 'Abrir WhatsApp');
    const ayuda = crear('p', { class: 'ayuda suave', id: 'aviso-ayuda' }, 'Primero abrí WhatsApp y enviá el mensaje. Si no lo enviás, no se registra.');
    const form = crear('form', { novalidate: true },
      crear('p', {}, crear('strong', {}, nombre), ' · se envía al ', crear('span', { id: 'aviso-telefono' }, '+' + p.telefono)),
      p.ya_avisado ? aviso('Ya se avisó este caso el ' + fechaHora(p.avisado_en, ctx.zona) + '. Podés volver a abrirlo, pero no hace falta registrarlo otra vez.', 'atencion') : null,
      texto, ayuda, err,
      crear('div', { class: 'fila-botones' }, abrir, registrar, crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cancelar')));
    enviar(form, err, async () => {
      if (!abierto) return;
      const r = await rpc('registrar_aviso', { p_socio_id: socioId, p_tipo: tipo });
      form.dataset.hecho = '1';
      await alRegistrar(r);
    });
    cont.replaceChildren(form);
  })();

  function botonCerrar() { return crear('button', { type: 'button', class: 'boton secundario', onclick: cerrar }, 'Cerrar'); }
  cont.limpiar = () => { activo = false; };
  return cont;
}

export function vistaAvisos(contenedor, ctx, params) {
  const tipo = params && params[0] === 'mora' ? 'mora' : 'vencimiento';
  let activa = true;
  let pedido = 0;
  let incluir = false;
  let formActual = null;
  const hoy = hoyEn(ctx.zona);

  const mensajes = crear('div', { class: 'zona-mensajes', 'aria-live': 'polite' });
  const pestanas = crear('nav', { class: 'pestanas', 'aria-label': 'Tipo de aviso' },
    ['vencimiento', 'mora'].map((t) => crear('a', { href: TIPOS[t].ruta, class: 'pestana' + (t === tipo ? ' activa' : ''), 'data-pestana': t,
      'aria-current': t === tipo ? 'page' : null }, TIPOS[t].pestana)));
  const interruptor = crear('input', { type: 'checkbox', id: 'ver-avisados' });
  const panel = crear('div', { class: 'panel-accion', id: 'panel-aviso' });
  const zona = crear('div', { id: 'zona-avisos', 'aria-live': 'polite' });

  contenedor.replaceChildren(
    crear('div', { class: 'cabecera-vista' }, crear('div', {}, crear('h2', {}, 'Avisos'),
      crear('p', { class: 'suave', id: 'linea-prefijo' }, 'Se envían por WhatsApp con el prefijo +' + (ctx.prefijo || '549') + '.'))),
    mensajes, pestanas,
    crear('label', { class: 'fila-interruptor', for: 'ver-avisados' }, interruptor, ' Mostrar también los ya avisados'),
    panel, zona);

  const cerrarPanel = () => { if (formActual && formActual.limpiar) formActual.limpiar(); formActual = null; panel.replaceChildren(); };

  function texto(s) {
    if (tipo === 'mora') return 'Venció el ' + fecha(s.vence_el) + ' · ' + plural(s.dias_atraso, 'día', 'días') + ' de atraso';
    const d = diasEntre(hoy, s.vence_el);
    return 'Vence el ' + fecha(s.vence_el) + ' · ' + (d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'en ' + d + ' días');
  }

  function abrirAviso(s) {
    cerrarPanel();
    const nombre = s.apellido + ', ' + s.nombre;
    formActual = formAviso({ ctx, socioId: s.socio_id, nombre, tipo, cerrar: cerrarPanel, alRegistrar: async () => {
      cerrarPanel();
      mensajes.replaceChildren(aviso('Aviso registrado: ' + nombre + '.', 'ok'));
      await cargar(true);
    } });
    panel.replaceChildren(crear('h3', {}, TIPOS[tipo].titulo), formActual);
    panel.scrollIntoView({ block: 'nearest' });
  }

  function fila(s) {
    return crear('li', { class: 'socio-item fila-aviso', 'data-socio': s.socio_id },
      crear('div', { class: 'socio-cab' },
        crear('span', { class: 'socio-nombre' }, s.apellido + ', ' + s.nombre,
          s.avisado ? crear('span', { class: 'etiqueta', 'data-avisado': '1' }, 'Avisado') : null),
        crear('span', { class: 'socio-sub' }, 'N.º ' + s.numero),
        crear('span', { class: 'socio-detalle-corto' }, texto(s))),
      crear('div', { class: 'fila-botones acciones-socio' },
        crear('button', { type: 'button', class: 'boton chico' + (s.avisado ? ' secundario' : ''), 'data-avisar': s.socio_id,
          onclick: () => abrirAviso(s) }, s.avisado ? 'Ver aviso' : 'Avisar')));
  }

  async function cargar(silencioso) {
    const mio = ++pedido;
    if (!enLinea()) { zona.replaceChildren(aviso('Sin conexión a internet. Cuando vuelva, recargá la pantalla.')); return; }
    if (!silencioso) zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));
    try {
      const r = await rpc('socios_para_avisar', { p_tipo: tipo, p_incluir_avisados: incluir });
      if (!activa || mio !== pedido) return;
      const socios = r.socios || [];
      const vacio = tipo === 'mora'
        ? (incluir ? 'No hay socios en mora.' : 'No queda nadie en mora por avisar.')
        : (incluir ? 'Nadie vence en los próximos ' + plural(ctx.diasAviso || 3, 'día', 'días') + '.' : 'No queda nadie por avisar: todos los que vencen pronto ya fueron avisados o no hay vencimientos.');
      zona.replaceChildren(...[
        crear('p', { class: 'suave', id: 'cuenta-avisos' }, socios.length === 0 ? '' : plural(r.cantidad, 'socio', 'socios')),
        socios.length === 0
          ? crear('div', { class: 'tarjeta vacia', id: 'avisos-vacio' }, crear('p', {}, vacio))
          : crear('ul', { class: 'lista-socios', id: 'lista-avisos' }, socios.map(fila)),
        r.hay_mas ? crear('p', { class: 'suave', id: 'hay-mas' }, 'Se muestran los primeros ' + r.cantidad + '. Al avisar, salen de la lista y aparecen los que siguen.') : null].filter(Boolean));
    } catch (e) { if (activa && mio === pedido) zona.replaceChildren(aviso(traducirError(e))); }
  }

  interruptor.addEventListener('change', () => { incluir = interruptor.checked; cerrarPanel(); cargar(); });
  cargar();
  return () => { activa = false; cerrarPanel(); };
}
