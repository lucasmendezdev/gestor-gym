// =====================================================================
// config.js · Gestor Gym · lo ÚNICO que se edita por cada cliente
// =====================================================================
// supabase_url y supabase_anon_key: Supabase > Project Settings > API.
//   Usá SIEMPRE la clave "anon" (pública). NUNCA pegues acá la "service_role".
// El resto es la marca del gimnasio. Si cambia el logo, poné el archivo
// en la carpeta img/ y escribí su nombre en "logo".
export const CONFIG = {
  supabase_url: 'https://TU-PROYECTO.supabase.co',
  supabase_anon_key: 'PEGAR-ACA-LA-CLAVE-ANON',

  nombre: 'Gestor Gym',          // se usa hasta que el negocio tenga nombre cargado
  logo: '',                      // por ejemplo 'img/logo.png' (vacío = sin logo)
  color_acento: '#0f766e',       // color principal de botones y menú
};
