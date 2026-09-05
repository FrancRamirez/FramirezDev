// i18n.js
// Sistema de idiomas del sitio (Español / English).
//
// Cómo funciona:
// 1) Al cargar la página, detectamos el idioma preferido del visitante:
//    - Si ya eligió un idioma antes (guardado en localStorage), usamos ese.
//    - Si no, miramos el idioma configurado en su sistema/navegador
//      (navigator.languages). Si aparece "es" en cualquiera de sus formas
//      (es, es-AR, es-MX, es-ES, etc.) mostramos español; en cualquier
//      otro caso (inglés, portugués, francés, etc.) mostramos inglés.
// 2) Recorremos el HTML buscando elementos marcados con:
//      data-i18n="clave"            -> traduce el texto visible (textContent)
//      data-i18n-html="clave"       -> traduce pero permite HTML simple (innerHTML),
//                                       usado solo donde ya había un <br> en el original
//      data-i18n-placeholder="clave"-> traduce el placeholder de inputs/textarea
//      data-i18n-aria-label="clave" -> traduce aria-label
//      data-i18n-alt="clave"        -> traduce el alt de una imagen
//      data-i18n-content="clave"    -> traduce el content de un <meta>
// 3) Exponemos window.I18N para que otros scripts (script.js) puedan
//    traducir textos generados dinámicamente (mensajes del formulario,
//    aria-labels de los puntos del carrusel, etc.) y para poder cambiar
//    de idioma manualmente en el futuro (setLanguage/toggleLanguage),
//    a través del botón #langToggle que hoy existe oculto en el navbar.

const I18N_STORAGE_KEY = 'framirezdev_lang';

// Diccionario de traducciones. Cada clave es un identificador que se usa
// en el HTML (data-i18n="clave") o desde JS (I18N.t('clave')).
const I18N_TRANSLATIONS = {
  es: {
    'meta.title': 'Francisco Ramirez | Desarrollador FullStack',
    'meta.description': 'Portfolio personal de Francisco Ramirez (Framirez) - Desarrollador FullStack Freelancer.',

    'nav.inicio': 'Inicio',
    'nav.sobreMi': 'Acerca de mí',
    'nav.proyectos': 'Proyectos',
    'nav.stack': 'Stack',
    'nav.estudios': 'Estudios',
    'nav.contacto': 'Contacto',
    'nav.toggleAria': 'Abrir menú',

    'hero.title': '¡Hola!',
    'hero.text': 'Bienvenid@s y muchas gracias por visitar mi página web',
    'hero.cta': 'Hablemos',
    'hero.imgNartoAlt': 'Captura del sitio NartoEV',
    'hero.imgHerreriaAlt': 'Captura del sitio Herrería Eduardo',

    'about.title': 'Acerca de mí',
    'about.text1': 'Mi nombre es Francisco, soy desarrollador Full-Stack y freelancer. Técnico Universitario Programador graduado de la Universidad Tecnológica Nacional.',
    'about.text2': 'Me dedico a ofrecer soluciones y servicios, sean para desarrollar páginas web, software o aplicaciones a los usuarios que lo necesitan.',

    'carousel.prevAria': 'Slide anterior',
    'carousel.nextAria': 'Slide siguiente',
    'carousel.dotAria': 'Ir al slide {n}',

    'projects.webTitle': 'Páginas Web',
    'projects.herreria.details': 'Sitio Web de Herreria en general.',
    'projects.narto.details': 'Sitio Web de Instaladores de cargadores para vehículos eléctricos.',

    'projects.appsTitle': 'Aplicaciones',
    'projects.galeria.iconAlt': 'Ícono de Galeria',
    'projects.galeria.details': 'Galeria de fotos.',
    'projects.blocnote.iconAlt': 'Ícono de BlocNote',
    'projects.blocnote.details': 'Bloc de notas para android.',
    'projects.download': 'Descarga',

    'projects.gamesTitle': 'Juegos',
    'projects.patra.iconAlt': 'Ícono Patras',
    'projects.patra.details': 'Juego de recoleccion y derrotar enemigos (Solo para escritorio).',

    'stack.title': 'Stack Informático',

    'estudios.title': 'Estudios',
    'estudios.imgAlt': 'Frente de la Universidad Tecnológica Nacional, Facultad Regional Pacheco',

    'contact.hint': '¿Tenés una idea o un proyecto en mente? ¡Hablemos!',
    'contact.formTitle': 'Contactá por Gmail <br>',
    'contact.labelNombre': 'Nombre',
    'contact.labelEmail': 'Email',
    'contact.labelMensaje': 'Mensaje',
    'contact.placeholderNombre': 'Tu nombre',
    'contact.placeholderEmail': 'Tu email',
    'contact.placeholderMensaje': 'Contame sobre tu proyecto...',
    'contact.submit': 'Enviar',
    'contact.submitting': 'Enviando...',
    'contact.errorFields': 'Por favor completá todos los campos.',
    'contact.errorEmail': 'Ingresá un email válido.',
    'contact.successDefault': '✓ ¡Gracias! Tu mensaje fue enviado.',
    'contact.errorSendDefault': 'Error al enviar el mensaje. Intenta de nuevo.',
    'contact.errorConnection': 'Error de conexión. Intenta de nuevo más tarde.',

    'footer.rights': 'Todos los derechos reservados',

    'lang.toggleLabel': 'Español',
  },

  en: {
    'meta.title': 'Francisco Ramirez | FullStack Developer',
    'meta.description': 'Personal portfolio of Francisco Ramirez (Framirez) - Freelance FullStack Developer.',

    'nav.inicio': 'Home',
    'nav.sobreMi': 'About me',
    'nav.proyectos': 'Projects',
    'nav.stack': 'Stack',
    'nav.estudios': 'Education',
    'nav.contacto': 'Contact',
    'nav.toggleAria': 'Open menu',

    'hero.title': 'Hi there!',
    'hero.text': 'Welcome, and thank you very much for visiting my website',
    'hero.cta': "Let's talk",
    'hero.imgNartoAlt': 'Screenshot of the NartoEV site',
    'hero.imgHerreriaAlt': 'Screenshot of the Herrería Eduardo site',

    'about.title': 'About me',
    'about.text1': "My name is Francisco, I'm a Full-Stack developer and freelancer. Programming graduate from National Technological University (UTN).",
    'about.text2': 'I offer solutions and services, whether developing websites, software, or applications for the users who need them.',

    'carousel.prevAria': 'Previous slide',
    'carousel.nextAria': 'Next slide',
    'carousel.dotAria': 'Go to slide {n}',

    'projects.webTitle': 'Websites',
    'projects.herreria.details': 'Website for a general metalwork business.',
    'projects.narto.details': 'Website for electric vehicle charger installers.',

    'projects.appsTitle': 'Applications',
    'projects.galeria.iconAlt': 'Galeria icon',
    'projects.galeria.details': 'Photo gallery app.',
    'projects.blocnote.iconAlt': 'BlocNote icon',
    'projects.blocnote.details': 'Notes app for Android.',
    'projects.download': 'Download',

    'projects.gamesTitle': 'Games',
    'projects.patra.iconAlt': 'Patra icon',
    'projects.patra.details': 'Collect-and-defeat-enemies game (desktop only).',

    'stack.title': 'Tech Stack',

    'estudios.title': 'Education',
    'estudios.imgAlt': 'Front of Universidad Tecnológica Nacional, Facultad Regional Pacheco',

    'contact.hint': "Have an idea or a project in mind? Let's talk!",
    'contact.formTitle': 'Contact me by email <br>',
    'contact.labelNombre': 'Name',
    'contact.labelEmail': 'Email',
    'contact.labelMensaje': 'Message',
    'contact.placeholderNombre': 'Your name',
    'contact.placeholderEmail': 'Your email',
    'contact.placeholderMensaje': 'Tell me about your project...',
    'contact.submit': 'Send',
    'contact.submitting': 'Sending...',
    'contact.errorFields': 'Please fill in all fields.',
    'contact.errorEmail': 'Enter a valid email address.',
    'contact.successDefault': '✓ Thank you! Your message was sent.',
    'contact.errorSendDefault': 'Error sending the message. Please try again.',
    'contact.errorConnection': 'Connection error. Please try again later.',

    'footer.rights': 'All rights reserved',

    'lang.toggleLabel': 'English',
  },
};

// Detecta el idioma inicial: preferencia guardada > idioma del sistema.
function i18nDetectLanguage() {
  const saved = localStorage.getItem(I18N_STORAGE_KEY);
  if (saved === 'es' || saved === 'en') return saved;

  // navigator.languages trae la lista completa de idiomas configurados
  // en el sistema/navegador del usuario; navigator.language es un fallback
  // para navegadores viejos que no soportan el array.
  const systemLangs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || 'en'];

  const hasSpanish = systemLangs.some((lang) => lang.toLowerCase().startsWith('es'));
  return hasSpanish ? 'es' : 'en';
}

// Estado actual del idioma
let i18nCurrentLang = i18nDetectLanguage();

// Traduce una clave. Soporta reemplazo simple de placeholders {n}.
function i18nT(key, params) {
  const dict = I18N_TRANSLATIONS[i18nCurrentLang] || I18N_TRANSLATIONS.en;
  let text = dict[key] ?? I18N_TRANSLATIONS.en[key] ?? key;

  if (params) {
    Object.keys(params).forEach((paramKey) => {
      text = text.replace(`{${paramKey}}`, params[paramKey]);
    });
  }

  return text;
}

// Aplica el idioma actual a todo el DOM marcado con data-i18n / data-i18n-*.
function i18nApplyToDOM() {
  document.documentElement.lang = i18nCurrentLang;

  // Texto visible plano: <elemento data-i18n="clave">
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = i18nT(el.getAttribute('data-i18n'));
  });

  // Texto con HTML simple permitido (ej: "Contactá por Gmail <br>")
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = i18nT(el.getAttribute('data-i18n-html'));
  });

  // Atributos traducibles
  const attrMap = {
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-alt': 'alt',
    'data-i18n-title': 'title',
    'data-i18n-content': 'content',
  };

  Object.entries(attrMap).forEach(([dataAttr, targetAttr]) => {
    document.querySelectorAll(`[${dataAttr}]`).forEach((el) => {
      el.setAttribute(targetAttr, i18nT(el.getAttribute(dataAttr)));
    });
  });

  // Botón de cambio de idioma (oculto por ahora vía CSS), si existe
  const langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.textContent = i18nT('lang.toggleLabel');
  }
}

// Cambia el idioma manualmente, lo guarda y re-traduce la página.
function i18nSetLanguage(lang) {
  if (lang !== 'es' && lang !== 'en') return;
  i18nCurrentLang = lang;
  localStorage.setItem(I18N_STORAGE_KEY, lang);
  i18nApplyToDOM();
}

// Alterna entre es <-> en (útil para el botón manual, hoy oculto).
function i18nToggleLanguage() {
  i18nSetLanguage(i18nCurrentLang === 'es' ? 'en' : 'es');
}

// API pública usada por script.js y por el botón (futuro) de cambio de idioma.
window.I18N = {
  get lang() { return i18nCurrentLang; },
  t: i18nT,
  setLanguage: i18nSetLanguage,
  toggleLanguage: i18nToggleLanguage,
  applyToDOM: i18nApplyToDOM,
};

document.addEventListener('DOMContentLoaded', () => {
  i18nApplyToDOM();

  const langToggle = document.getElementById('langToggle');
  langToggle?.addEventListener('click', i18nToggleLanguage);
});
