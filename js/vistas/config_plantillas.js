// Configuración · Plantillas de aviso por WhatsApp (solo dueño).
import { crear, cliente, rpc, traducirError } from '../comun.js?v=13';
import { aviso, enviar, flash } from '../ui.js?v=13';
import { fechaHora } from '../formato.js?v=13';

const TIPOS = [
  { tipo: 'bienvenida', titulo: 'Bienvenida', vars: ['nombre', 'numero'], cuando: 'Se manda desde la ficha del socio.' },
  { tipo: 'vencimiento', titulo: 'Vencimiento', vars: ['nombre', 'vence'], cuando: 'Para quienes están por vencer.' },
  { tipo: 'mora', titulo: 'Mora', vars: ['nombre', 'vence', 'dias'], cuando: 'Para quienes tienen la cuota vencida.' },
];
const EJEMPLO = { nombre: 'Ana', numero: '12', vence: '20/11/2026', dias: '5' };
const vista = (t) => t.replace(/\{([a-z_]+)\}/g, (m, k) => (k in EJEMPLO ? EJEMPLO[k] : m));

export function vistaPlantillas(contenedor, ctx) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite', class: 'lista-plantillas' });
  const mensajes = crear('div', { class: 'zona-mensajes' });
  contenedor.replaceChildren(
    crear('p', {}, crear('a', { href: '#/configuracion', class: 'enlace-simple' }, '← Volver a Configuración')),
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Plantillas de aviso')),
    crear('p', { class: 'suave' }, 'El texto de los mensajes de WhatsApp. Las palabras entre llaves, como {nombre}, se reemplazan por los datos de cada socio.'),
    mensajes, zona);
  flash(ctx, mensajes);

  function tarjeta(t, fila) {
    const texto = crear('textarea', { id: 'p-' + t.tipo, rows: '4', maxlength: '600', required: true, 'aria-label': 'Texto del aviso de ' + t.titulo.toLowerCase() });
    texto.value = fila.texto;
    const prev = crear('p', { class: 'vista-previa', id: 'prev-' + t.tipo });
    const cuenta = crear('span', { class: 'suave', id: 'cuenta-' + t.tipo });
    const err = crear('div', { 'aria-live': 'polite' });
    const actualizar = () => { prev.textContent = vista(texto.value); cuenta.textContent = texto.value.length + ' / 600'; };
    texto.addEventListener('input', () => { err.replaceChildren(); actualizar(); });
    const insertar = (v) => {
      const i = texto.selectionStart == null ? texto.value.length : texto.selectionStart, j = texto.selectionEnd == null ? i : texto.selectionEnd;
      texto.value = texto.value.slice(0, i) + '{' + v + '}' + texto.value.slice(j);
      texto.focus(); const p = i + v.length + 2; texto.setSelectionRange(p, p); actualizar();
    };
    const f = crear('form', { class: 'formulario tarjeta', 'data-plantilla': t.tipo, novalidate: true },
      crear('h3', {}, t.titulo), crear('p', { class: 'suave' }, t.cuando),
      texto,
      crear('div', { class: 'fila-botones variables' }, t.vars.map((v) => crear('button', { type: 'button', class: 'boton secundario chico', 'data-var': v, onclick: () => insertar(v) }, '{' + v + '}'))),
      cuenta,
      crear('p', { class: 'suave' }, 'Así lo verá un socio (con datos de ejemplo):'), prev,
      err,
      crear('p', { class: 'suave', id: 'act-' + t.tipo }, 'Última edición: ' + fechaHora(fila.actualizado_en, ctx.zona)),
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', 'data-guardar': t.tipo }, 'Guardar')));
    actualizar();
    enviar(f, err, async () => {
      await rpc('editar_plantilla', { p_tipo: t.tipo, p_texto: texto.value });
      err.replaceChildren(aviso('Guardado.', 'ok'));
      f.querySelector('#act-' + t.tipo).textContent = 'Última edición: ' + fechaHora(new Date().toISOString(), ctx.zona);
    });
    return f;
  }

  (async () => {
    try {
      const { data, error } = await cliente().from('plantillas_aviso').select('tipo, texto, actualizado_en');
      if (error) throw error;
      if (!activa) return;
      zona.replaceChildren(...TIPOS.map((t) => {
        const fila = data.find((x) => x.tipo === t.tipo);
        return fila ? tarjeta(t, fila) : crear('div', { class: 'tarjeta' }, crear('h3', {}, t.titulo), aviso('Este aviso no tiene plantilla en la base.'));
      }));
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();
  return () => { activa = false; };
}
