// comun.js · conexión con Supabase y utilidades compartidas.
// Regla de oro: lo que viene de la base se muestra SIEMPRE con textContent,
// nunca con innerHTML.
import { CONFIG } from './config.js?v=17';

export const VERSION = 'Etapa 11 · v17';

export function configurado() {
  const u = CONFIG.supabase_url || '';
  const k = CONFIG.supabase_anon_key || '';
  return u.startsWith('https://') && !u.includes('TU-PROYECTO') && k.length > 20 && !k.includes('PEGAR');
}

let _cliente = null;
export function cliente() {
  if (_cliente) return _cliente;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    throw new Error('FALTA_LIBRERIA');
  }
  _cliente = window.supabase.createClient(CONFIG.supabase_url, CONFIG.supabase_anon_key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return _cliente;
}

// Traduce cualquier error a un mensaje claro en español.
export function traducirError(e) {
  const m = String((e && e.message) || e || '');
  if (m === 'FALTA_LIBRERIA') return 'Falta el archivo js/vendor/supabase.js en el sitio. Mirá js/vendor/LEEME.txt.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
    return 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.';
  }
  if (/invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Tenés que confirmar tu email antes de ingresar.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  if (/jwt expired|invalid jwt|not authenticated/i.test(m)) return 'Tu sesión venció. Volvé a ingresar.';
  if (/permission denied/i.test(m)) return 'No tenés permiso para hacer esto.';
  // Los mensajes que escribimos nosotros en la base ya vienen en español.
  return m || 'Ocurrió un error inesperado.';
}

export async function obtenerPerfil() {
  const c = cliente();
  const { data: s, error: e1 } = await c.auth.getSession();
  if (e1) throw e1;
  const sesion = s && s.session;
  if (!sesion) return { sesion: null, perfil: null };
  const { data, error } = await c.from('perfiles').select('id, rol, nombre, activo').eq('id', sesion.user.id).maybeSingle();
  if (error) throw error;
  return { sesion, perfil: data || null };
}

export async function rpc(nombre, args) {
  const { data, error } = await cliente().rpc(nombre, args || {});
  if (error) throw error;
  return data;
}

export const enLinea = () => navigator.onLine !== false;

export function aplicarMarca(nombre) {
  const raiz = document.documentElement;
  if (/^#[0-9a-fA-F]{6}$/.test(CONFIG.color_acento || '')) {
    raiz.style.setProperty('--acento', CONFIG.color_acento);
  }
  const n = nombre || CONFIG.nombre;
  document.querySelectorAll('[data-version]').forEach((el) => { el.textContent = VERSION; });
  document.querySelectorAll('[data-nombre-gym]').forEach((el) => { el.textContent = n; });
  document.title = n;
  const logo = document.querySelector('[data-logo]');
  if (logo) {
    if (CONFIG.logo) { logo.src = CONFIG.logo; logo.hidden = false; } else { logo.hidden = true; }
  }
}

// Crea un elemento: crear('div', {class:'x'}, 'texto', otroElemento)
export function crear(tag, props, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const h of hijos.flat(Infinity)) {
    if (h == null || h === false) continue;
    el.append(h.nodeType ? h : document.createTextNode(String(h)));
  }
  return el;
}

const ICONOS = {
  inicio: 'M3 11l9-8 9 8M5 10v10h14V10',
  socios: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21c0-4 4-6 8-6s8 2 8 6',
  cobrar: 'M3 7h18v10H3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  asistencia: 'M5 13l4 4L19 7',
  caja: 'M4 8l8-4 8 4v10l-8 4-8-4zM4 8l8 4 8-4M12 12v10',
  rutinas: 'M6 6v12M18 6v12M3 9v6M21 9v6M6 12h12',
  avisos: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  reportes: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  configuracion: 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  salir: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
};
export function icono(nombre) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icono');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONOS[nombre] || ICONOS.inicio);
  svg.append(p);
  return svg;
}
