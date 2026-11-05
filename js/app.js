import { CONFIG } from './config.js';
import { configurado, cliente, obtenerPerfil, traducirError, aplicarMarca, crear, icono, enLinea } from './comun.js';
import { VISTAS } from './vistas.js';

// Orden del menú. "principal" = va en la barra inferior del teléfono.
const SECCIONES = [
  { id: 'inicio', titulo: 'Inicio', principal: true },
  { id: 'socios', titulo: 'Socios', principal: true },
  { id: 'cobrar', titulo: 'Cobrar', principal: true },
  { id: 'asistencia', titulo: 'Asistencia', principal: true },
  { id: 'caja', titulo: 'Caja' },
  { id: 'avisos', titulo: 'Avisos' },
  { id: 'reportes', titulo: 'Reportes', soloDueno: true },
  { id: 'configuracion', titulo: 'Configuración', soloDueno: true },
];

const $ = (id) => document.getElementById(id);
let ctx = null;
let visibles = [];
let limpiar = null;

function irAlLogin() { location.replace('index.html'); }

async function salir() {
  try { await cliente().auth.signOut(); } catch (_) { /* igual salimos */ }
  irAlLogin();
}

function seccionActual() {
  const id = (location.hash || '').replace(/^#\/?/, '');
  const s = visibles.find((x) => x.id === id);
  return s || visibles[0];
}

function enlace(s, clase) {
  const a = crear('a', { href: '#/' + s.id, class: clase, 'data-seccion': s.id }, icono(s.id), crear('span', {}, s.titulo));
  return a;
}

function armarMenu() {
  const lateral = $('menu-lateral');
  const inferior = $('menu-inferior');
  const mas = $('panel-mas');
  lateral.replaceChildren(...visibles.map((s) => enlace(s, 'item')));

  const principales = visibles.filter((s) => s.principal);
  const resto = visibles.filter((s) => !s.principal);
  inferior.replaceChildren(...principales.map((s) => enlace(s, 'item')));
  mas.replaceChildren(...resto.map((s) => enlace(s, 'item')));

  if (resto.length) {
    const b = crear('button', { type: 'button', class: 'item', id: 'boton-mas', 'aria-expanded': 'false', 'aria-controls': 'panel-mas' },
      icono('mas'), crear('span', {}, 'Más'));
    b.addEventListener('click', () => alternarMas());
    inferior.append(b);
  }
}

function alternarMas(forzar) {
  const panel = $('panel-mas');
  const abrir = forzar === undefined ? panel.hidden : forzar;
  panel.hidden = !abrir;
  const b = $('boton-mas');
  if (b) b.setAttribute('aria-expanded', String(abrir));
}

function pintar() {
  const s = seccionActual();
  if (location.hash !== '#/' + s.id) { history.replaceState(null, '', '#/' + s.id); }
  document.querySelectorAll('[data-seccion]').forEach((a) => {
    if (a.dataset.seccion === s.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const enMas = !visibles.find((x) => x.id === s.id).principal;
  const b = $('boton-mas');
  if (b) b.classList.toggle('activo', enMas);
  $('titulo-seccion').textContent = s.titulo;
  alternarMas(false);
  if (typeof limpiar === 'function') { try { limpiar(); } catch (_) { /* nada */ } }
  limpiar = null;
  const vista = VISTAS[s.id];
  try { limpiar = vista($('contenido'), ctx); } catch (e) {
    $('contenido').replaceChildren(crear('div', { class: 'tarjeta' }, crear('p', { class: 'error-texto' }, traducirError(e))));
  }
  if (!$('contenido').contains(document.activeElement)) $('contenido').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function avisoConexion() {
  $('sin-conexion').hidden = enLinea();
  document.body.classList.toggle('sin-conexion', !enLinea());
}

// Vuelve a mirar quién es el usuario: si lo desactivaron, lo sacamos.
async function verificarVigencia() {
  try {
    const { sesion, perfil } = await obtenerPerfil();
    if (!sesion || !perfil || !perfil.activo) irAlLogin();
  } catch (_) { /* sin conexión: se reintenta al volver */ }
}

async function arrancar() {
  if (!configurado())