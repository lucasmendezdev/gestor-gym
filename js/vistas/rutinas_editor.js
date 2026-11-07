// Rutinas · editor de una rutina (solo dueño): datos, días y ejercicios con series, repeticiones y descanso.
import { crear, cliente, rpc, traducirError } from '../comun.js?v=17';
import { campo, aviso, enviar, esUuid } from '../ui.js?v=17';

const MAX_DIAS = 7; const MAX_EJ = 30;
const diaNuevo = (n) => ({ nombre: 'Día ' + n, ejercicios: [ejNuevo()] });
const ejNuevo = () => ({ ejercicio_id: '', series: '3', repeticiones: '10', descanso_seg: '', nota: '' });

export function vistaEditor(contenedor, ctx, id) {
  let activa = true;
  const zona = crear('div', { 'aria-live': 'polite' });
  contenedor.replaceChildren(crear('p', {}, crear('a', { href: '#/rutinas', class: 'enlace-simple' }, '← Volver a Rutinas')), zona);
  zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));

  (async () => {
    try {
      const { data: ejs, error } = await cliente().from('ejercicios').select('id, nombre, grupo_muscular, activo').order('nombre');
      if (error) throw error;
      let r = null;
      if (id) {
        if (!esUuid(id)) throw new Error('La rutina no existe.');
        const res = await cliente().from('rutinas').select('id, nombre, objetivo, notas, dias, version, activa').eq('id', id).maybeSingle();
        if (res.error) throw res.error;
        if (!res.data) throw new Error('La rutina no existe.');
        r = res.data;
      }
      if (!activa) return;
      armar(ejs, r);
    } catch (e) { if (activa) zona.replaceChildren(aviso(traducirError(e))); }
  })();

  function armar(ejs, r) {
    const act = ejs.filter((e) => e.activo);
    if (!act.length && !r) {
      zona.replaceChildren(crear('div', { class: 'tarjeta vacia', id: 'sin-ejercicios' },
        crear('h2', {}, 'Primero cargá ejercicios'), crear('p', {}, 'Para armar una rutina necesitás ejercicios en el catálogo.'),
        crear('a', { href: '#/rutinas/ejercicios', class: 'boton enlace-boton' }, 'Ir a Ejercicios')));
      return;
    }
    const porId = new Map(ejs.map((e) => [e.id, e]));
    const est = {
      nombre: r ? r.nombre : '', objetivo: r && r.objetivo ? r.objetivo : '', notas: r && r.notas ? r.notas : '',
      dias: r ? r.dias.map((d) => ({ nombre: d.nombre, ejercicios: d.ejercicios.map((e) => ({ ejercicio_id: e.ejercicio_id, series: String(e.series), repeticiones: e.repeticiones,
        descanso_seg: e.descanso_seg == null ? '' : String(e.descanso_seg), nota: e.nota || '' })) })) : [diaNuevo(1)],
    };
    const nombre = crear('input', { id: 'r-nombre', type: 'text', maxlength: '60', required: true, value: est.nombre });
    const objetivo = crear('input', { id: 'r-objetivo', type: 'text', maxlength: '120', value: est.objetivo });
    const notas = crear('textarea', { id: 'r-notas', rows: '2', maxlength: '1000' }); notas.value = est.notas;
    nombre.addEventListener('input', () => { est.nombre = nombre.value; });
    objetivo.addEventListener('input', () => { est.objetivo = objetivo.value; });
    notas.addEventListener('input', () => { est.notas = notas.value; });
    const zonaDias = crear('div', { id: 'zona-dias' });
    const err = crear('div', { 'aria-live': 'polite' });

    function mover(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; pintarDias(); }
    const btn = (id2, texto, fn, clase, desactivado) => crear('button', { type: 'button', id: id2, class: 'boton secundario chico ' + (clase || ''), disabled: desactivado || false, onclick: fn }, texto);
    const entrada = (tipo, id2, valor, atributos, alCambiar) => { const i = crear('input', Object.assign({ type: tipo, id: id2, value: valor }, atributos)); i.addEventListener('input', () => alCambiar(i.value)); return i; };

    function filaEj(di, ei) {
      const d = est.dias[di]; const e = d.ejercicios[ei]; const p = 'd' + di + 'e' + ei;
      const sel = crear('select', { id: p + '-ejercicio', 'aria-label': 'Ejercicio' }, crear('option', { value: '' }, 'Elegí un ejercicio…'),
        act.map((x) => crear('option', { value: x.id, selected: x.id === e.ejercicio_id }, x.nombre + (x.grupo_muscular ? ' · ' + x.grupo_muscular : ''))),
        e.ejercicio_id && !act.some((x) => x.id === e.ejercicio_id) ? crear('option', { value: e.ejercicio_id, selected: true }, ((porId.get(e.ejercicio_id) || {}).nombre || 'Ejercicio') + ' (archivado)') : null);
      sel.addEventListener('change', () => { e.ejercicio_id = sel.value; });
      const mini = (et, input) => crear('label', { class: 'ej-mini', for: input.id }, crear('span', { class: 'suave' }, et), input);
      return crear('div', { class: 'ej-fila', 'data-ej': di + '-' + ei },
        sel,
        crear('div', { class: 'ej-numeros' },
          mini('Series', entrada('text', p + '-series', e.series, { inputmode: 'numeric', maxlength: '2' }, (v) => { e.series = v; })),
          mini('Repeticiones', entrada('text', p + '-reps', e.repeticiones, { maxlength: '20' }, (v) => { e.repeticiones = v; })),
          mini('Descanso (seg)', entrada('text', p + '-desc', e.descanso_seg, { inputmode: 'numeric', maxlength: '3', placeholder: 'opcional' }, (v) => { e.descanso_seg = v; }))),
        entrada('text', p + '-nota', e.nota, { maxlength: '200', placeholder: 'Nota (opcional)', 'aria-label': 'Nota del ejercicio' }, (v) => { e.nota = v; }),
        crear('div', { class: 'fila-botones' },
          btn(p + '-subir', '↑', () => mover(d.ejercicios, ei, -1), '', ei === 0), btn(p + '-bajar', '↓', () => mover(d.ejercicios, ei, 1), '', ei === d.ejercicios.length - 1),
          btn(p + '-quitar', 'Quitar', () => { d.ejercicios.splice(ei, 1); pintarDias(); }, 'peligro', d.ejercicios.length === 1)));
    }

    function pintarDias() {
      zonaDias.replaceChildren(...est.dias.map((d, di) => {
        const nom = entrada('text', 'd' + di + '-nombre', d.nombre, { maxlength: '40', 'aria-label': 'Nombre del día' }, (v) => { d.nombre = v; });
        return crear('section', { class: 'tarjeta dia-editor', 'data-dia': String(di) },
          crear('div', { class: 'dia-cabecera' }, campo('Día ' + (di + 1), nom),
            crear('div', { class: 'fila-botones' },
              btn('d' + di + '-subir', '↑ Día', () => mover(est.dias, di, -1), '', di === 0), btn('d' + di + '-bajar', '↓ Día', () => mover(est.dias, di, 1), '', di === est.dias.length - 1),
              btn('d' + di + '-quitar', 'Quitar día', () => { est.dias.splice(di, 1); pintarDias(); }, 'peligro', est.dias.length === 1))),
          d.ejercicios.map((_, ei) => filaEj(di, ei)),
          btn('d' + di + '-agregar', 'Agregar ejercicio', () => { if (d.ejercicios.length >= MAX_EJ) { err.replaceChildren(aviso('Cada día admite hasta ' + MAX_EJ + ' ejercicios.')); return; } err.replaceChildren(); d.ejercicios.push(ejNuevo()); pintarDias(); }));
      }));
      agregarDia.disabled = est.dias.length >= MAX_DIAS;
    }
    const agregarDia = crear('button', { type: 'button', class: 'boton secundario', id: 'btn-agregar-dia', onclick: () => { est.dias.push(diaNuevo(est.dias.length + 1)); pintarDias(); } }, 'Agregar día');

    const f = crear('form', { class: 'formulario', novalidate: true, id: 'form-rutina' },
      campo('Nombre de la rutina', nombre), campo('Objetivo (opcional)', objetivo, 'Por ejemplo: ganar fuerza, bajar de peso.'),
      campo('Notas generales (opcional)', notas, 'Entrada en calor, indicaciones, etc.'),
      crear('h3', {}, 'Días y ejercicios'), zonaDias,
      crear('div', { class: 'fila-botones' }, agregarDia),
      r ? crear('p', { class: 'suave', id: 'aviso-version' }, 'Al guardar, la rutina pasa a la versión ' + (r.version + 1) + '. Lo ya asignado a socios no cambia: cada socio conserva la copia que recibió.') : null,
      err,
      crear('div', { class: 'fila-botones' }, crear('button', { type: 'submit', class: 'boton', id: 'btn-guardar-rutina' }, r ? 'Guardar cambios' : 'Crear rutina'),
        crear('a', { href: '#/rutinas', class: 'boton secundario enlace-boton' }, 'Cancelar')));
    zona.replaceChildren(crear('h2', {}, r ? 'Editar rutina' : 'Nueva rutina'), f);
    pintarDias();

    enviar(f, err, async () => {
      const dias = est.dias.map((d, di) => ({
        nombre: d.nombre.trim(),
        ejercicios: d.ejercicios.map((e, ei) => {
          const lugar = 'en el día "' + (d.nombre.trim() || 'Día ' + (di + 1)) + '", ejercicio ' + (ei + 1);
          if (!e.ejercicio_id) throw new Error('Elegí el ejercicio ' + lugar + '.');
          if (!/^[0-9]{1,2}$/.test(e.series.trim())) throw new Error('Las series deben ser un número entero (' + lugar + ').');
          if (!e.repeticiones.trim()) throw new Error('Escribí las repeticiones ' + lugar + ' (por ejemplo 8-10).');
          const dsc = e.descanso_seg.trim();
          if (dsc !== '' && !/^[0-9]{1,3}$/.test(dsc)) throw new Error('El descanso debe ser un número de segundos (' + lugar + ').');
          return { ejercicio_id: e.ejercicio_id, series: Number(e.series), repeticiones: e.repeticiones.trim(), descanso_seg: dsc === '' ? null : Number(dsc), nota: e.nota.trim() };
        }),
      }));
      if (r) await rpc('editar_rutina', { p_id: r.id, p_nombre: est.nombre, p_objetivo: est.objetivo.trim(), p_notas: est.notas.trim(), p_dias: dias });
      else await rpc('crear_rutina', { p_nombre: est.nombre, p_objetivo: est.objetivo, p_notas: est.notas, p_dias: dias });
      f.dataset.hecho = '1';
      ctx.flash = r ? 'Rutina guardada.' : 'Rutina creada.';
      location.hash = '#/rutinas';
    });
  }
  return () => { activa = false; };
}
