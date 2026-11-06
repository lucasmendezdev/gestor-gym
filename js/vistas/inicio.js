// Pantalla de inicio: resumen del día. Recepción ve contadores; el dueño, además, el dinero.
import { crear, rpc, traducirError, enLinea } from '../comun.js?v=11';
import { moneda, fechaLarga, plural } from '../formato.js?v=11';

function tarjeta(titulo, valor, nota, clase, href) {
  return crear(href ? 'a' : 'div', { class: 'dato ' + (clase || '') + (href ? ' enlace-dato' : ''), href: href || null },
    crear('div', { class: 'dato-titulo' }, titulo),
    crear('div', { class: 'dato-valor' }, valor),
    nota ? crear('div', { class: 'dato-nota' }, nota) : null);
}

function textoCaja(c) {
  if (!c.hay_caja) return { v: 'Sin abrir', n: 'No hay caja abierta', clase: '' };
  if (c.de_dia_anterior) return { v: 'Abierta de ayer', n: 'Hay que cerrarla (la cierra el dueño)', clase: 'alerta' };
  return { v: 'Abierta', n: '', clase: 'bueno' };
}

function pintarResumen(cont, r, ctx) {
  const caja = textoCaja(r.caja);
  const bloques = [
    crear('p', { class: 'fecha-hoy' }, fechaLarga(r.fecha)),
    crear('div', { class: 'grilla-datos', 'data-bloque': 'operacion' },
      tarjeta('Socios activos', String(r.socios_activos)),
      tarjeta('Adentro ahora', String(r.adentro_ahora)),
      tarjeta('Entraron hoy', String(r.entraron_hoy)),
      tarjeta('Caja', caja.v, caja.n, caja.clase),
      tarjeta('Vencen pronto', String(r.vencen_pronto),
        'En los próximos ' + plural(r.dias_aviso_vencimiento, 'día', 'días') + (r.vencen_pronto ? ' · ' + r.vencen_pronto_sin_avisar + ' sin avisar' : ''),
        r.vencen_pronto ? 'atencion' : '', '#/avisos'),
      tarjeta('En mora', String(r.en_mora),
        r.en_mora ? r.en_mora_sin_avisar + ' sin avisar' : 'Nadie vencido',
        r.en_mora ? 'alerta' : '', '#/avisos/mora')),
  ];
  if (r.dinero) {
    const d = r.dinero;
    const medios = d.cobrado_hoy_por_medio || [];
    bloques.push(
      crear('h2', { class: 'subtitulo' }, 'Dinero de hoy'),
      crear('div', { class: 'grilla-datos', 'data-bloque': 'dinero' },
        tarjeta('Cobrado hoy', moneda(d.cobrado_hoy), 'En efectivo: ' + moneda(d.cobrado_hoy_efectivo)),
        tarjeta('Otros ingresos', moneda(d.ingresos_hoy)),
        tarjeta('Gastos', moneda(d.gastos_hoy)),
        tarjeta('Retiros', moneda(d.retiros_hoy)),
        tarjeta('Altas del mes', String(d.altas_del_mes))),
      medios.length
        ? crear('div', { class: 'tarjeta lista-medios' },
            crear('h3', {}, 'Cobrado por medio de pago'),
            crear('ul', {}, medios.map((m) => crear('li', {}, crear('span', {}, m.medio), crear('strong', {}, moneda(m.total))))))
        : null);
  }
  cont.replaceChildren(...bloques.filter(Boolean));
}

export function vistaInicio(contenedor, ctx) {
  let activa = true;
  let cargando = false;
  let ultima = 0;
  const zona = crear('div', { class: 'zona-resumen', 'aria-live': 'polite' });
  const boton = crear('button', { type: 'button', class: 'boton secundario chico', id: 'actualizar' }, 'Actualizar');
  const saludo = crear('div', { class: 'cabecera-vista' },
    crear('div', {}, crear('h2', {}, 'Hola, ' + ctx.perfil.nombre), crear('p', { class: 'suave', id: 'rol-linea' }, ctx.negocio)),
    boton);
  contenedor.replaceChildren(saludo, zona);

  async function cargar() {
    if (cargando || !activa) return;
    if (!enLinea()) {
      zona.replaceChildren(crear('div', { class: 'tarjeta' }, crear('p', { class: 'error-texto' }, 'Sin conexión a internet. Cuando vuelva, tocá Actualizar.')));
      return;
    }
    cargando = true; boton.disabled = true;
    if (!zona.firstChild) zona.replaceChildren(crear('p', { class: 'suave' }, 'Cargando…'));
    try {
      const r = await rpc('resumen_de_inicio');
      if (!activa) return;
      pintarResumen(zona, r, ctx);
      ultima = Date.now();
    } catch (e) {
      if (!activa) return;
      zona.replaceChildren(crear('div', { class: 'tarjeta' }, crear('p', { class: 'error-texto' }, traducirError(e))));
    } finally { cargando = false; boton.disabled = false; }
  }

  boton.addEventListener('click', cargar);
  const alVolver = () => { if (!document.hidden && Date.now() - ultima > 30000) cargar(); };
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('online', cargar);
  cargar();
  return () => { activa = false; document.removeEventListener('visibilitychange', alVolver); window.removeEventListener('online', cargar); };
}
