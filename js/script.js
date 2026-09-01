// script.js

document.addEventListener('DOMContentLoaded', () => {
  initStarryBackground();
  toggleMobileMenu();
  closeMenuOnLinkClick();
  initCarousel('proyectos', { autoplayMs: 10000 });
  handleContactForm();
  setFooterYear();
});


// Menú hamburguesa (mobile)
function toggleMobileMenu() {
  const toggleBtn = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');

  if (!toggleBtn || !menu) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggleBtn.classList.toggle('is-open', isOpen);
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
  });
}


// Cierra el menú mobile al tocar un link
function closeMenuOnLinkClick() {
  const links = document.querySelectorAll('.nav-link');
  const menu = document.getElementById('navMenu');
  const toggleBtn = document.getElementById('navToggle');

  links.forEach((link) => {
    link.addEventListener('click', () => {
      menu?.classList.remove('is-open');
      toggleBtn?.classList.remove('is-open');
      toggleBtn?.setAttribute('aria-expanded', 'false');
    });
  });
}


// Fondo estrellado dinámico con estrellas procedurales y meteoros
function initStarryBackground() {
  const canvas = document.getElementById('starsCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Seed para generación procedural consistente
  const seed = 12345;
  const random = (() => {
    let value = seed;
    return () => {
      value = (value * 9301 + 49297) % 233280;
      return value / 233280;
    };
  })();

  // Generar estrellas proceduralmente
  const stars = [];
  const starCount = Math.floor((canvas.width * canvas.height) / 5000);
  
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: random() * canvas.width,
      y: random() * canvas.height,
      radius: random() * 1.5,
      opacity: random() * 0.5 + 0.3,
      twinkleSpeed: random() * 0.03 + 0.01,
      phase: random() * Math.PI * 2,
    });
  }

  // Meteoros (estrellas fugaces)
  const meteors = [];
  const maxMeteors = 3;

  function createMeteor() {
    if (meteors.length >= maxMeteors) return;
    
    meteors.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height * 0.6),
      velocityX: Math.random() * 4 + 2,
      velocityY: Math.random() * 2 + 1,
      length: Math.random() * 60 + 40,
      opacity: 1,
      trail: [],
    });
  }

  function drawStars() {
    // Fondo oscuro
    ctx.fillStyle = 'rgba(10, 18, 38, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar estrellas con parpadeo
    stars.forEach((star) => {
      star.phase += star.twinkleSpeed;
      const brightness = Math.sin(star.phase) * 0.35 + 0.65;
      
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * brightness})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function updateMeteors() {
    meteors.forEach((meteor, index) => {
      meteor.x += meteor.velocityX;
      meteor.y += meteor.velocityY;
      meteor.opacity -= 0.01;

      // Trail del meteoro
      if (!meteor.trail) meteor.trail = [];
      meteor.trail.push({ x: meteor.x, y: meteor.y, opacity: meteor.opacity });
      
      if (meteor.trail.length > 10) {
        meteor.trail.shift();
      }

      // Dibujar trail (estela)
      if (meteor.trail.length > 1) {
        for (let i = 0; i < meteor.trail.length - 1; i++) {
          const current = meteor.trail[i];
          const next = meteor.trail[i + 1];
          
          ctx.strokeStyle = `rgba(255, 200, 100, ${current.opacity * 0.8})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(current.x, current.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
      }

      // Dibujar núcleo del meteoro
      ctx.fillStyle = `rgba(255, 255, 255, ${meteor.opacity})`;
      ctx.beginPath();
      ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Remover meteoro si está fuera de pantalla
      if (meteor.x > canvas.width || meteor.y > canvas.height || meteor.opacity <= 0) {
        meteors.splice(index, 1);
      }
    });
  }

  function animate() {
    drawStars();
    updateMeteors();

    // Crear nuevo meteoro aleatoriamente
    if (Math.random() < 0.01) {
      createMeteor();
    }

    requestAnimationFrame(animate);
  }

  // Redibujar al redimensionar
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  animate();
}


// Gap (px) entre slides mientras desliza; debe coincidir con el CSS
const SLIDE_GAP_PX = 100;

// Carrusel genérico (flechas, dots, autoplay)
function initCarousel(name, options = {}) {
  const track = document.getElementById(`${name}Track`);
  if (!track) return;

  const slides = track.querySelectorAll('.carousel__slide');
  if (slides.length === 0) return;

  const carouselEl = track.closest('[data-carousel]');
  const dotsContainer = document.getElementById(`${name}Dots`);
  const prevBtn = carouselEl?.querySelector('.carousel__arrow--prev');
  const nextBtn = carouselEl?.querySelector('.carousel__arrow--next');

  let currentIndex = 0;
  let autoplayTimer = null;

  if (slides.length === 1) {
    if (dotsContainer) dotsContainer.style.display = 'none';
    if (prevBtn) prevBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    return;
  }

  slides[0].classList.add('is-active');

  let dots = [];
  if (dotsContainer) {
    slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Ir al slide ${index + 1}`);
      if (index === 0) dot.classList.add('is-active');

      dot.addEventListener('click', () => {
        goToSlide(index);
        restartAutoplay();
      });
      dotsContainer.appendChild(dot);
    });
    dots = dotsContainer.querySelectorAll('button');
  }

  // Mueve el track al slide "index" y actualiza dots/opacidad
  function goToSlide(index) {
    currentIndex = (index + slides.length) % slides.length;
    track.style.transform = `translateX(calc(-${currentIndex} * (100% + ${SLIDE_GAP_PX}px)))`;

    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === currentIndex);
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === currentIndex);
    });
  }

  prevBtn?.addEventListener('click', () => {
    goToSlide(currentIndex - 1);
    restartAutoplay();
  });

  nextBtn?.addEventListener('click', () => {
    goToSlide(currentIndex + 1);
    restartAutoplay();
  });

  function startAutoplay() {
    if (!options.autoplayMs) return;
    autoplayTimer = setInterval(() => goToSlide(currentIndex + 1), options.autoplayMs);
  }

  function restartAutoplay() {
    if (!options.autoplayMs) return;
    clearInterval(autoplayTimer);
    startAutoplay();
  }

  startAutoplay();
}


// Validación y envío (simulado) del formulario de contacto
function handleContactForm() {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');

  if (!form || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const nombre = form.nombre.value.trim();
    const email = form.email.value.trim();
    const mensaje = form.mensaje.value.trim();

    if (!nombre || !email || !mensaje) {
      showStatus('Por favor completá todos los campos.', 'error');
      return;
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      showStatus('Ingresá un email válido.', 'error');
      return;
    }

    // TODO: conectar a backend/servicio de envío real (Formspree, EmailJS, etc.)
    console.log('Formulario listo para enviar:', { nombre, email, mensaje });

    showStatus('¡Gracias! Tu mensaje fue enviado.', 'success');
    form.reset();
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(type === 'success' ? 'is-success' : 'is-error');
  }
}


// Año actual en el footer
function setFooterYear() {
  const yearSpan = document.getElementById('year');
  if (!yearSpan) return;
  yearSpan.textContent = new Date().getFullYear();
}
