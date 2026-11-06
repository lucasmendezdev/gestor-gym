// Alta de socio.
import { crear, rpc } from '../comun.js?v=5';
import { campo, aviso, enviar, limpiarTelefono, soloNumeros } from '../ui.js?v=5';

export function vistaSocioNuevo(contenedor, ctx) {
  const esDueno = ctx.perfil.rol === 'dueno';
  const apellido = crear('input', { id: 'f-apellido', type: 'text', maxlength: '60', autocomplete: 'off', required: true });
  const nombre = crear('input', { id: 'f-nombre', type: 'text', maxlength: '60', autocomplete: 'off', required: true });
  const dni = crear('input', { id: 'f-dni', type: 'text', inputmode: 'numeric', maxlength: '12', autocomplete: 'off', required: true });
  const tel = crear('input', { id: 'f-tel', type: 'tel', inputmode: 'tel', maxlength: '20', autocomplete: 'off', required: true });
  const obs = crear('textarea', { id: 'f-obs', maxlength: '500', rows: '3' });
  const informado = crear('input', { id: 'f-informado', type: 'checkbox' });
  const numero = esDueno ? crear('input', { id: 'f-numero', type: 'text', inputmode: 'numeric', maxlength: '7', autocomplete: 'off' }) : null;
  const vistaTel = crear('p', { class: 'ayuda suave', id: 'vista-tel', 'aria-live': 'polite' });
  const errores = crear('div', { 'aria-live': 'polite' });
  const guardar = crear('button', { type: 'submit', class: 'boton' }, 'Crear socio');

  function actualizarTel() {
    const t = limpiarTelefono(tel.value);
    vistaTel.className = 'ayuda ' + (t.length > 10 ? 'advertencia' : 'suave');
    if (!t) { vistaTel.textContent = 'Con código de área, sin 0 y sin 15. Ejemplo: 2604123456.'; return; }
    vistaTel.textContent = t.length > 10
      ? 'Se guardará como ' + t + '. Un celular argentino son 10 números (código de área + número, sin 0 ni 15): revisalo.'
      : 'Se guardará como ' + t + '.';
  }
  tel.addEventListener('input', actualizarTel);
  actualizarTel();

  const form = crear('form', { class: 'tarjeta formulario', novalidate: true },
    campo('Apellido', apellido), campo('Nombre', nombre),
    campo('DNI', dni, 'Solo números (se aceptan puntos, se guardan sin ellos).'),
    crear('div', { class: 'campo' }, crear('label', { for: 'f-tel' }, 'Teléfono (WhatsApp)'), tel, vistaTel),
    campo('Observaciones (opcional)', obs, 'Lesiones, avisos importantes. Hasta 500 caracteres.'),
    crear('div', { class: 'campo casilla' }, informado,
      crear('label', { for: 'f-informado' }, 'Le informé al socio cómo se usan sus datos personales')),
    numero ? campo('Número de socio (opcional)', numero, 'Solo el dueño puede fijarlo. Vacío = el siguiente número libre.') : null,
    errores,
    crear('div', { class: 'fila-botones' }, guardar, crear('a', { href: '#/socios', class: 'boton secundario enlace-boton' }, 'Cancelar')));

  contenedor.replaceChildren(
    crear('div', { class: 'cabecera-vista' }, crear('h2', {}, 'Nuevo socio')),
    form);
  apellido.focus({ preventScroll: true });

  enviar(form, errores, async () => {
    const args = {
      p_nombre: nombre.value, p_apellido: apellido.value, p_dni: dni.value, p_telefono: tel.value,
      p_observaciones: obs.value.trim() || null, p_datos_informados: informado.checked,
    };
    if (numero && numero.value.trim()) args.p_numero = parseInt(soloNumeros(numero.value), 10);
    try {
      const s = await rpc('crear_socio', args);
      form.dataset.hecho = '1';   // no permitir un segundo envío mientras se abre la ficha
      ctx.flash = 'Socio creado: N.º ' + s.numero + ', ' + s.apellido + ', ' + s.nombre + '.';
      location.hash = '#/socios/' + s.id;
    } catch (e) {
      const m = /Ya existe un socio con ese DNI \(número (\d+)\)/.exec(String((e && e.message) || ''));
      if (m) {
        const n = m[1];
        errores.replaceChildren(aviso(e.message),
          crear('a', { href: '#/socios', class: 'enlace-simple', 'data-buscar': n, onclick: () => { ctx.busqueda = n; } }, 'Buscar al socio N.º ' + n));
        return;
      }
      throw e;
    }
  });
}
