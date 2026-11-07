import { CONFIG } from './config.js?v=16';
import { configurado, cliente, obtenerPerfil, rpc, traducirError, aplicarMarca } from './comun.js?v=16';

const $ = (id) => document.getElementById(id);
aplicarMarca();

function mostrar(panel) {
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== panel; });
  const primero = document.querySelector('[data-panel="' + panel + '"] input');
  if (primero) primero.focus();
  mensaje('');
}
function mensaje(texto) {
  const m = $('mensaje');
  m.textContent = texto || '';
  m.hidden = !texto;
}
function ocupado(form, si) {
  form.querySelectorAll('button, input').forEach((el) => { el.disabled = si; });
}

async function decidir() {
  const { sesion, perfil } = await obtenerPerfil();
  if (!sesion) return mostrar('login');
  if (perfil && perfil.activo) { location.replace('app.html'); return; }
  if (perfil && !perfil.activo) return mostrar('bloqueado');
  const hay = await rpc('hay_negocio');
  mostrar(hay ? 'canje' : 'setup');
}

async function salir() {
  try { await cliente().auth.signOut(); } catch (_) { /* igual volvemos al inicio */ }
  mostrar('login');
}

async function enviar(form, accion) {
  mensaje('');
  ocupado(form, true);
  try { await accion(); } catch (e) { mensaje(traducirError(e)); } finally { ocupado(form, false); }
}

function iniciar() {
  if (!configurado()) {
    $('aviso-config').hidden = false;
    $('aviso-config').textContent = 'Falta configurar el sitio: completá supabase_url y supabase_anon_key en js/config.js.';
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = true; });
    return;
  }
  try { cliente(); } catch (e) {
    $('aviso-config').hidden = false;
    $('aviso-config').textContent = traducirError(e);
    document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = true; });
    return;
  }

  $('form-login').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    enviar(f, async () => {
      const email = $('email').value.trim();
      const clave = $('clave').value;
      if (!email || !clave) throw new Error('Escribí tu email y tu contraseña.');
      const { error } = await cliente().auth.signInWithPassword({ email, password: clave });
      if (error) throw error;
      $('clave').value = '';
      await decidir();
    });
  });

  $('form-setup').addEventListener('submit', (ev) => {
    ev.preventDefault();
    enviar(ev.currentTarget, async () => {
      await rpc('crear_negocio', { p_nombre: $('setup-gym').value, p_nombre_dueno: $('setup-nombre').value });
      await decidir();
    });
  });

  $('form-canje').addEventListener('submit', (ev) => {
    ev.preventDefault();
    enviar(ev.currentTarget, async () => {
      await rpc('canjear_invitacion', { p_codigo: $('canje-codigo').value, p_nombre: $('canje-nombre').value });
      await decidir();
    });
  });

  document.querySelectorAll('[data-salir]').forEach((b) => b.addEventListener('click', salir));

  decidir().catch((e) => { mostrar('login'); mensaje(traducirError(e)); });
}

iniciar();
