// js/vitals.js
//
// Medición de Core Web Vitals (LCP, CLS, INP) más FCP y TTFB como apoyo.
//
// Diseño "poco invasivo":
//   - Cero dependencias y cero pedidos de red mientras el usuario navega:
//     solo usa PerformanceObserver (pasivo, lo resuelve el navegador).
//   - Se envía UN solo beacon por visita, cuando la pestaña pasa a segundo
//     plano o se cierra (visibilitychange/pagehide). sendBeacon no bloquea
//     la navegación ni compite con el resto de la página.
//   - No usa cookies, localStorage ni identificadores. Solo manda métricas,
//     la ruta, un tipo de dispositivo aproximado y el tipo de conexión.
//   - Todo va dentro de try/catch: si el navegador no soporta algo, no pasa
//     nada y el sitio sigue normal.
//
// Nota: es una implementación liviana. Para INP usa el evento más lento
// observado (con interactionId), una aproximación razonable al p98 de la
// librería oficial `web-vitals` en páginas con pocas interacciones.

(function () {
  'use strict';

  if (!('PerformanceObserver' in window) || !navigator.sendBeacon) return;

  var m = { lcp: null, cls: 0, inp: null, fcp: null, ttfb: null };
  var enviado = false;

  function observar(tipo, cb, extra) {
    try {
      var po = new PerformanceObserver(function (lista) {
        lista.getEntries().forEach(cb);
      });
      var opts = { type: tipo, buffered: true };
      if (extra) for (var k in extra) opts[k] = extra[k];
      po.observe(opts);
    } catch (e) {
      /* tipo no soportado: se ignora */
    }
  }

  // TTFB
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav) m.ttfb = nav.responseStart;
  } catch (e) {}

  // FCP
  observar('paint', function (e) {
    if (e.name === 'first-contentful-paint') m.fcp = e.startTime;
  });

  // LCP: se queda con la última entrada
  observar('largest-contentful-paint', function (e) {
    m.lcp = e.startTime;
  });

  // CLS: ventanas de sesión (máx. 5 s, hueco de 1 s), se queda con la peor
  var sesionValor = 0;
  var sesionInicio = 0;
  var sesionUltima = 0;
  observar('layout-shift', function (e) {
    if (e.hadRecentInput) return;
    if (
      sesionValor &&
      e.startTime - sesionUltima < 1000 &&
      e.startTime - sesionInicio < 5000
    ) {
      sesionValor += e.value;
    } else {
      sesionValor = e.value;
      sesionInicio = e.startTime;
    }
    sesionUltima = e.startTime;
    if (sesionValor > m.cls) m.cls = sesionValor;
  });

  // INP (aprox.): interacción más lenta
  observar(
    'event',
    function (e) {
      if (!e.interactionId) return;
      if (m.inp === null || e.duration > m.inp) m.inp = e.duration;
    },
    { durationThreshold: 40 }
  );

  function dispositivo() {
    var w = window.innerWidth;
    return w < 768 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop';
  }

  function enviar() {
    if (enviado) return;
    // Sin LCP ni FCP no hubo render útil (pestaña abierta en background, etc.)
    if (m.lcp === null && m.fcp === null) return;
    enviado = true;

    var c = navigator.connection || {};
    var payload = {
      pagina: location.pathname.slice(0, 120),
      lcp: m.lcp,
      cls: m.cls,
      inp: m.inp,
      fcp: m.fcp,
      ttfb: m.ttfb,
      dispositivo: dispositivo(),
      conexion: (c.effectiveType || '').slice(0, 10) || null,
    };

    try {
      navigator.sendBeacon(
        '/api/visitas?action=vitals',
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
      );
    } catch (e) {}
  }

  // visibilitychange (hidden) es el momento más fiable, también en móviles.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') enviar();
  });
  window.addEventListener('pagehide', enviar);
})();
