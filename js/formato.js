// formato.js · formatos argentinos y estados de socio.
const MONEDA = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function moneda(n) {
  const v = Number(n);
  return Number.isFinite(v) ? MONEDA.format(v).replace(/ /g, ' ') : '—';
}

// 'YYYY-MM-DD' -> 'DD/MM/AAAA' (sin pasar por Date: no hay corrimientos de zona)
export function fecha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '—';
}

export function fechaLarga(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const t = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Hoy (YYYY-MM-DD) en la zona horaria del negocio
export function hoyEn(zona) {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: zona || 'America/Argentina/Mendoza' }); }
  catch (_) { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Mendoza' }); }
}

export function diasEntre(desdeIso, hastaIso) {
  const a = Date.UTC(+desdeIso.slice(0, 4), +desdeIso.slice(5, 7) - 1, +desdeIso.slice(8, 10));
  const b = Date.UTC(+hastaIso.slice(0, 4), +hastaIso.slice(5, 7) - 1, +hastaIso.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

export const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

// Estado de un socio (la respuesta de buscar_socio) -> texto, detalle y clase de color.
export function estadoSocio(s, hoy) {
  switch (s.estado) {
    case 'al_dia': {
      const d = s.vence_el && hoy ? diasEntre(hoy, s.vence_el) : null;
      let cuando = '';
      if (d === 0) cuando = ' (vence hoy)';
      else if (d === 1) cuando = ' (vence mañana)';
      else if (d !== null && d > 1) cuando = ' (en ' + d + ' días)';
      return { texto: 'Al día', detalle: 'Vence el ' + fecha(s.vence_el) + cuando, clase: 'ok' };
    }
    case 'vencida':
      if (s.tiene_cobros === false) {
        return { texto: 'Pendiente de primer cobro', detalle: 'Todavía no se le cobró la primera cuota', clase: 'atencion' };
      }
      return { texto: 'Vencido hace ' + plural(s.dias_atraso, 'día', 'días'), detalle: 'Venció el ' + fecha(s.vence_el), clase: 'mal' };
    case 'congelada':
      return { texto: 'Congelado', detalle: 'Congelado hasta el ' + fecha(s.congelada_hasta), clase: 'frio' };
    case 'sin_membresia':
      return { texto: 'Sin membresía', detalle: 'No tiene una membresía activa', clase: 'neutro' };
    case 'baja':
      return { texto: 'De baja', detalle: 'El socio fue dado de baja', clase: 'neutro' };
    default:
      return { texto: 'Estado desconocido', detalle: '', clase: 'neutro' };
  }
}
