    /* ---------- Traducciones ---------- */
    console.log("[Landing] main-landing.js LOADED", new Date().toISOString());

    const translations = {
      en: {
        nav_home: 'Home',
        nav_how: 'How it works',
        nav_features: 'Features',
        nav_contact: 'Contact',
        btn_signin: 'Sign In',
        tag_books: 'Books',
        tag_series: 'Series',
        tag_movies: 'Movies',
        tag_games: 'Games',
        hero_kicker: 'Your watchlist, bookshelf & backlog in one place',
        hero_title: 'One home for everything you<br>watch, read &amp; play<span class="dot">.</span>',
        hero_subtitle: 'Quacker is your personal hub for shows, movies, books and games — so you always know what you’re on, what’s next and what you’ve already finished.',
        btn_start: 'Create my library',
        btn_watch_how: 'See Quacker in action',
        hero_social: 'Join early users organising thousands of titles with Quacker.',
        how_kicker: 'How it works',
        how_title: 'Three simple steps to stay on track',
        how_subtitle: 'Quacker turns your messy watchlists into a single, playful place.',
        how_step1_title: 'Create your library',
        how_step1_text: 'Add the shows, movies, books and games you’re into. Import or start fresh.',
        how_step2_title: 'Update as you go',
        how_step2_text: 'Log new episodes, chapters or play sessions. Everything updates instantly.',
        how_step3_title: 'Discover & set goals',
        how_step3_text: 'Explore new titles, set challenges and let Quacker cheer you on.',
        features_kicker: 'Features',
        features_title: 'Everything you need in one nest',
        features_subtitle: 'From a dashboard to detailed stats — everything stays in sync.',
        feature1_tag: 'Dashboard',
        feature1_title: 'Overview',
        feature1_text: 'Streaks, progress and what\'s next.',
        feature2_tag: 'Library',
        feature2_title: 'Unified library',
        feature2_text: 'Series, movies, books and games.',
        feature3_tag: 'Explore',
        feature3_title: 'Discovery',
        feature3_text: 'Find titles from APIs and catalogs.',
        feature4_tag: 'Stats',
        feature4_title: 'Analytics',
        feature4_text: 'Trends and insights month by month.',
        feature5_tag: 'Lists',
        feature5_title: 'Custom lists',
        feature5_text: 'Create, organize and share lists.',
        feature6_tag: 'Goals',
        feature6_title: 'Challenges',
        feature6_text: 'Set monthly watch/read/play goals.',
        feature7_tag: 'Import',
        feature7_title: 'Import',
        feature7_text: 'Bring data from CSV or other services.',
        feature8_tag: 'Profile',
        feature8_title: 'Profile & notifications',
        feature8_text: 'Themes, reminders and privacy.',
        contact_kicker: 'Contact',
        contact_title: 'Get in touch',
        contact_subtitle: 'Send us a message if you have feedback, ideas or want to say hi.',
        contact_form_title: 'Send us a message',
        contact_name_label: 'Name',
        contact_email_label: 'Email',
        contact_message_label: 'Message',
        contact_send: 'Send Message',
        contact_side_intro: 'We’re still building Quacker, and we’d love to hear how you’d like to use it. Your message can influence what we build next:',
        contact_side_li1: 'Tell us which stats and dashboards you’d love.',
        contact_side_li2: 'Ask for integrations with your favourite apps.',
        contact_side_li3: 'Volunteer to test early features and betas.',
        contact_side_email: 'Prefer email? Reach us at <strong>hello@quacker.app</strong>.',
        footer_text: 'Quacker. All rights reserved.',
        auth_title_login: 'Welcome back!',
        auth_subtitle_login: 'Access your personal library',
        auth_title_register: 'Create your account',
        auth_subtitle_register: 'Start tracking what you watch, read and play.',
        tab_login: 'Sign In',
        tab_register: 'Sign Up',
        auth_name_label: 'Name',
        auth_email_label: 'Email',
        auth_password_label: 'Password',
        auth_email_placeholder: 'you@email.com',
        auth_name_placeholder: 'Your name',
        auth_password_placeholder: 'Your password',
        auth_forgot: 'Forgot your password?',
        auth_btn_login: 'Sign In',
        auth_btn_register: 'Sign Up',
        auth_legal: 'By signing in you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.',
        contact_name_placeholder: 'Your name',
        contact_email_placeholder: 'your@email.com',
        contact_message_placeholder: 'Tell us what\'s on your mind...',
        error_required: 'Please fill in email and password.',
        error_name: 'Please enter your name.',
        error_password_length: 'Password must be at least 4 characters long.',
        error_email_invalid: 'Enter a valid email.',
        auth_loading_login: 'Signing in...',
        auth_loading_register: 'Creating account...',
        auth_show_password: 'Show password',
        auth_hide_password: 'Hide password'
      },
      es: {
        nav_home: 'Inicio',
        nav_how: 'Cómo funciona',
        nav_features: 'Funciones',
        nav_contact: 'Contacto',
        btn_signin: 'Iniciar sesión',
        tag_books: 'Libros',
        tag_series: 'Series',
        tag_movies: 'Películas',
        tag_games: 'Videojuegos',
        hero_kicker: 'Tu lista de series, libros y juegos, por fin ordenada',
        hero_title: 'Un solo sitio para todo lo que<br>ves, lees y juegas<span class="dot">.</span>',
        hero_subtitle: 'Quacker es tu centro de control para series, pelis, libros y videojuegos — así siempre sabes qué sigues, qué toca ahora y qué ya has terminado.',
        btn_start: 'Crear mi biblioteca',
        btn_watch_how: 'Ver Quacker en acción',
        hero_social: 'Únete a quienes ya organizan miles de títulos con Quacker.',
        how_kicker: 'Cómo funciona',
        how_title: 'Tres pasos sencillos para estar al día',
        how_subtitle: 'Quacker convierte tus listas caóticas en un único espacio ordenado y divertido.',
        how_step1_title: 'Crea tu biblioteca',
        how_step1_text: 'Añade las series, pelis, libros y juegos que sigues. Importa tus datos o empieza desde cero.',
        how_step2_title: 'Actualiza sobre la marcha',
        how_step2_text: 'Registra nuevos episodios, capítulos o sesiones de juego. Todo se actualiza al instante.',
        how_step3_title: 'Descubre y marca objetivos',
        how_step3_text: 'Explora títulos nuevos, marca retos mensuales y deja que Quacker te anime.',
        features_kicker: 'Funciones',
        features_title: 'Todo lo que necesitas en un mismo nido',
        features_subtitle: 'Desde un panel general hasta estadísticas detalladas: todo se mantiene sincronizado.',
        feature1_tag: 'Panel',
        feature1_title: 'Vista general',
        feature1_text: 'Rachas, progreso y qué viene después.',
        feature2_tag: 'Biblioteca',
        feature2_title: 'Biblioteca unificada',
        feature2_text: 'Series, películas, libros y videojuegos.',
        feature3_tag: 'Explorar',
        feature3_title: 'Descubrimiento',
        feature3_text: 'Encuentra títulos usando catálogos y APIs.',
        feature4_tag: 'Estadísticas',
        feature4_title: 'Analítica',
        feature4_text: 'Tendencias y datos mes a mes.',
        feature5_tag: 'Listas',
        feature5_title: 'Listas personalizadas',
        feature5_text: 'Crea, organiza y comparte tus listas.',
        feature6_tag: 'Objetivos',
        feature6_title: 'Retos',
        feature6_text: 'Marca objetivos mensuales de ver, leer o jugar.',
        feature7_tag: 'Importar',
        feature7_title: 'Importación',
        feature7_text: 'Trae tus datos desde CSV u otros servicios.',
        feature8_tag: 'Perfil',
        feature8_title: 'Perfil y avisos',
        feature8_text: 'Temas, recordatorios y privacidad.',
        contact_kicker: 'Contacto',
        contact_title: 'Ponte en contacto',
        contact_subtitle: 'Envíanos un mensaje si tienes feedback, ideas o simplemente quieres saludar.',
        contact_form_title: 'Envíanos un mensaje',
        contact_name_label: 'Nombre',
        contact_email_label: 'Email',
        contact_message_label: 'Mensaje',
        contact_send: 'Enviar mensaje',
        contact_side_intro: 'Seguimos construyendo Quacker y nos encantaría saber cómo te gustaría usarlo. Tu mensaje puede influir en la hoja de ruta:',
        contact_side_li1: 'Cuéntanos qué estadísticas y paneles te gustaría ver.',
        contact_side_li2: 'Pide integraciones con tus aplicaciones favoritas.',
        contact_side_li3: 'Apúntate para probar funciones en beta.',
        contact_side_email: '¿Prefieres email? Escríbenos a <strong>hello@quacker.app</strong>.',
        footer_text: 'Quacker. Todos los derechos reservados.',
        auth_title_login: '¡Bienvenido de vuelta!',
        auth_subtitle_login: 'Accede a tu biblioteca personal',
        auth_title_register: 'Crea tu cuenta',
        auth_subtitle_register: 'Empieza a trackear lo que ves, lees y juegas.',
        tab_login: 'Iniciar sesión',
        tab_register: 'Registrarse',
        auth_name_label: 'Nombre',
        auth_email_label: 'Email',
        auth_password_label: 'Contraseña',
        auth_email_placeholder: 'tu@email.com',
        auth_name_placeholder: 'Tu nombre',
        auth_password_placeholder: 'Tu contraseña',
        auth_forgot: '¿Olvidaste tu contraseña?',
        auth_btn_login: 'Iniciar sesión',
        auth_btn_register: 'Registrarse',
        auth_legal: 'Al iniciar sesión aceptas nuestros <a href="#">Términos de servicio</a> y <a href="#">Política de privacidad</a>.',
        contact_name_placeholder: 'Tu nombre',
        contact_email_placeholder: 'tu@email.com',
        contact_message_placeholder: 'Cuéntanos qué tienes en mente...',
        error_required: 'Por favor, rellena el email y la contraseña.',
        error_name: 'Escribe tu nombre para crear la cuenta.',
        error_password_length: 'La contraseña debe tener al menos 4 caracteres.',
        error_email_invalid: 'Escribe un email válido.',
        auth_loading_login: 'Entrando...',
        auth_loading_register: 'Creando cuenta...',
        auth_show_password: 'Mostrar contraseña',
        auth_hide_password: 'Ocultar contraseña'
      }
    };

    let currentLang = 'en';

    function applyTranslations() {
      const dict = translations[currentLang];
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (dict[key]) {
          el.innerHTML = dict[key];
        }
      });

      const attrMap = [
        { sel: '#email', attr: 'placeholder', key: 'auth_email_placeholder' },
        { sel: '#name', attr: 'placeholder', key: 'auth_name_placeholder' },
        { sel: '#password', attr: 'placeholder', key: 'auth_password_placeholder' },
        { sel: '#cname', attr: 'placeholder', key: 'contact_name_placeholder' },
        { sel: '#cemail', attr: 'placeholder', key: 'contact_email_placeholder' },
        { sel: '#cmessage', attr: 'placeholder', key: 'contact_message_placeholder' }
      ];
      attrMap.forEach(({ sel, attr, key }) => {
        const el = document.querySelector(sel);
        if (el && dict[key]) el[attr] = dict[key];
      });
    }

    function setLanguage(lang) {
      currentLang = lang;
      localStorage.setItem('quacker_lang', lang);
      document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
      applyTranslations();
    }

    /* ---------- Tema oscuro ---------- */

    const themeToggle = document.getElementById("themeToggle");

    function applyTheme(theme) {
      const isDark = theme === 'dark';
      document.body.classList.toggle('dark-theme', isDark);
      themeToggle.classList.toggle('is-dark', isDark);
      localStorage.setItem('quacker_theme', isDark ? 'dark' : 'light');
    }

    themeToggle.addEventListener("click", () => {
      const newTheme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
      applyTheme(newTheme);
    });

    /* ---------- Nav activo, scroll, contacto ---------- */

    function escapeHtml(str) {
      return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    document.getElementById("year").textContent = new Date().getFullYear();

    const navLinks = document.querySelectorAll(".nav-link");
    function updateActiveLink() {
      const ids = ["top", "how-it-works", "features", "contact"];
      let current = "top";
      const y = window.scrollY + 120;
      ids.forEach(id => {
        const sec = document.getElementById(id);
        if (sec && y >= sec.offsetTop) current = id;
      });
      navLinks.forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === "#" + current);
      });
    }
    window.addEventListener("scroll", updateActiveLink);
    window.addEventListener("load", updateActiveLink);

    navLinks.forEach(link => {
      link.addEventListener("click", e => {
        e.preventDefault();
        const id = link.getAttribute("href").slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        const top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: "smooth" });
      });
    });

    document.getElementById("contactForm").addEventListener("submit", (e) => {
      e.preventDefault();

      window.toast({
        title: currentLang === "es" ? "Mensaje enviado" : "Message sent",
        message: currentLang === "es"
          ? "Gracias. Te responderemos lo antes posible."
          : "Thanks. We’ll get back to you soon.",
        type: "success",
        duration: 2600
      });

      e.target.reset();
    });

    // Botón "volver arriba"
    const scrollTopBtn = document.getElementById('scrollTopBtn');

    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollTopBtn.classList.add('show');
      } else {
        scrollTopBtn.classList.remove('show');
      }
    });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });

    /* ---------- Modal auth ---------- */

    const btnSignIn = document.getElementById('btnSignIn');
    const btnStartTracking = document.getElementById('btnStartTracking');

    // =========================
    // Transport init (Landing)
    // =========================
    // Regla clara:
    // - Si estamos en el server Node (puerto 3000): SIEMPRE http + /api
    // - Si no: restauramos sessionStorage (para modo local / pruebas)
    (function initApiTransport() {
      try {
        const isNodeServer = String(window.location.port) === "3000";

        if (isNodeServer) {
          if (window.ApiClient?.setBaseUrl) ApiClient.setBaseUrl("/api");
          if (window.ApiClient?.setTransport) ApiClient.setTransport("http");

          // Persistimos para que al recargar no vuelva a "local"
          try {
            sessionStorage.setItem("quacker_transport", "http");
            sessionStorage.setItem("quacker_baseUrl", "/api");
          } catch (_) {}

          return;
        }

        // En estático, respetamos sessionStorage si existe
        const savedTransport = sessionStorage.getItem("quacker_transport");
        const savedBaseUrl = sessionStorage.getItem("quacker_baseUrl");

        if (savedBaseUrl && window.ApiClient?.setBaseUrl) ApiClient.setBaseUrl(savedBaseUrl);
        if (savedTransport && window.ApiClient?.setTransport) ApiClient.setTransport(savedTransport);
      } catch (_) {}
    })();

    const authOverlay = document.getElementById('authOverlay');
    const authClose = document.getElementById('authClose');

    const authDialog = document.getElementById('authDialog');

    let __authLastFocusEl = null;

    function getFocusable(container) {
      if (!container) return [];
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
      ].join(',');

      return Array.from(container.querySelectorAll(selector))
        .filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function trapTabInAuth(e) {
      if (!authOverlay || !authOverlay.classList.contains('is-open')) return;
      if (e.key !== 'Tab') return;

      const focusables = getFocusable(authDialog);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (!authDialog.contains(active)) {
        e.preventDefault();
        first.focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
        return;
      }

      if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const titleEl = document.getElementById('authTitle');
    const subtitleEl = document.getElementById('authSubtitle');
    const groupName = document.getElementById('groupName');
    const submitText = document.getElementById('submitText');
    const forgotWrapper = document.getElementById('forgotWrapper');
    const form = document.getElementById('authForm');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const errorEl = document.getElementById('authError');
    const emailInput = document.getElementById('email');
    const nameInput = document.getElementById('name');

    const submitBtn = document.getElementById('authSubmitBtn');
    const submitSpinner = document.getElementById('authSubmitSpinner');

    let __authSubmitting = false;

    const nameErrorEl = document.getElementById('nameError');
    const emailErrorEl = document.getElementById('emailError');
    const passwordErrorEl = document.getElementById('passwordError');

    function getWrapper(inputEl) {
      if (!inputEl) return null;
      return inputEl.closest('.form-group-auth')?.querySelector('.input-wrapper-auth') || null;
    }

    function setFieldError(inputEl, errorEl, message) {
      const wrapper = getWrapper(inputEl);

      if (!message) {
        if (errorEl) {
          errorEl.textContent = '';
          errorEl.classList.add('hidden');
        }
        if (wrapper) {
          wrapper.classList.remove('is-invalid');
          wrapper.classList.add('is-valid');
        }
        if (inputEl) inputEl.setAttribute('aria-invalid', 'false');
        return;
      }

      if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
      }
      if (wrapper) {
        wrapper.classList.add('is-invalid');
        wrapper.classList.remove('is-valid');
      }
      if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
    }

    function isValidEmail(email) {
      // Simple y suficiente para UI (sin prometer validación “servidor”)
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function validateName() {
      const dict = translations[currentLang];
      if (mode !== 'register') {
        setFieldError(nameInput, nameErrorEl, '');
        return true;
      }
      const name = (nameInput?.value || '').trim();
      if (name.length < 2) {
        setFieldError(nameInput, nameErrorEl, dict.error_name);
        return false;
      }
      setFieldError(nameInput, nameErrorEl, '');
      return true;
    }

    function validateEmail() {
      const dict = translations[currentLang];
      const email = (emailInput?.value || '').trim();

      if (!email) {
        // Reutilizamos tu texto existente para “requerido”
        setFieldError(emailInput, emailErrorEl, dict.error_required);
        return false;
      }
      if (!isValidEmail(email)) {
        setFieldError(emailInput, emailErrorEl, dict.error_email_invalid);
        return false;
      }
      setFieldError(emailInput, emailErrorEl, '');
      return true;
    }

    function validatePassword() {
      const dict = translations[currentLang];
      const pass = (passwordInput?.value || '').trim();

      if (!pass) {
        setFieldError(passwordInput, passwordErrorEl, dict.error_required);
        return false;
      }
      if (pass.length < 4) {
        setFieldError(passwordInput, passwordErrorEl, dict.error_password_length);
        return false;
      }
      setFieldError(passwordInput, passwordErrorEl, '');
      return true;
    }

    // Validación al escribir (sin molestar demasiado)
    emailInput?.addEventListener('input', () => {
      if (emailErrorEl && !emailErrorEl.classList.contains('hidden')) validateEmail();
    });
    passwordInput?.addEventListener('input', () => {
      if (passwordErrorEl && !passwordErrorEl.classList.contains('hidden')) validatePassword();
    });
    nameInput?.addEventListener('input', () => {
      if (nameErrorEl && !nameErrorEl.classList.contains('hidden')) validateName();
    });

    // Validación al salir del campo
    emailInput?.addEventListener('blur', validateEmail);
    passwordInput?.addEventListener('blur', validatePassword);
    nameInput?.addEventListener('blur', validateName);


    let mode = 'login';

    function openAuth(initialMode = 'login') {
      __authLastFocusEl = document.activeElement;

      setMode(initialMode);

      authOverlay.classList.add('is-open');
      authOverlay.setAttribute('aria-hidden', 'false');

      document.body.classList.add('no-scroll');

      // Focus al primer input útil
      window.setTimeout(() => {
        if (emailInput) emailInput.focus();
        else authDialog?.focus();
      }, 0);
    }

    function closeAuth({ restoreFocus = true } = {}) {
      authOverlay.classList.remove('is-open');
      authOverlay.setAttribute('aria-hidden', 'true');

      document.body.classList.remove('no-scroll');

      errorEl.classList.add('hidden');
      errorEl.textContent = '';
      form.reset();
      setMode('login');

      if (restoreFocus) {
        const toFocus = __authLastFocusEl || btnSignIn || btnStartTracking;
        if (toFocus && typeof toFocus.focus === 'function') {
          window.setTimeout(() => toFocus.focus(), 0);
        }
      }
    }

    // Abrir desde botones
    btnSignIn?.addEventListener('click', (e) => {
      e.preventDefault();
      openAuth('login');
    });

    btnStartTracking?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!btnStartTracking) return;

      // Anti doble click
      if (btnStartTracking.dataset.busy === "1") return;
      btnStartTracking.dataset.busy = "1";
      btnStartTracking.setAttribute("aria-busy", "true");

      try {
        // DEV server (3000): fuerza HTTP + /api antes de comprobar sesión
        try {
          const isNodeServer = String(window.location.port) === "3000";
          if (isNodeServer) {
            if (window.ApiClient?.setBaseUrl) ApiClient.setBaseUrl("/api");
            if (window.ApiClient?.setTransport) ApiClient.setTransport("http");
          }
        } catch (_) {}

        // Si hay sesión válida, vamos directos al dashboard
        if (window.ApiClient && typeof ApiClient.getCurrentSession === "function") {
          const session = await ApiClient.getCurrentSession();
          console.log("[StartTracking] session:", session, "transport:", ApiClient.getTransportInfo());
          if (session && session.user) {
            console.log("[StartTracking] redirecting to dashboard...");
            window.location.assign("dashboard.html");
            return;
          }
        }

        // Si no hay sesión, abrimos registro
        openAuth("register");
      } finally {
        // Si no hemos navegado, liberamos busy
        btnStartTracking.dataset.busy = "0";
        btnStartTracking.removeAttribute("aria-busy");
      }
    });

    // Cerrar con el botón X
    authClose?.addEventListener('click', (e) => {
      e.preventDefault();
      closeAuth();
    });

    // Cerrar al click fuera (solo si el click es en el overlay)
    authOverlay?.addEventListener('click', (e) => {
      if (e.target === authOverlay) closeAuth({ restoreFocus: false });
    });

    // Escape cierra
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!authOverlay || !authOverlay.classList.contains('is-open')) return;
      closeAuth();
    });

    // Trap de Tab dentro del modal
    document.addEventListener('keydown', trapTabInAuth);

    function setMode(newMode) {
      mode = newMode;
      const dict = translations[currentLang];
      if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        titleEl.innerHTML = dict.auth_title_login;
        subtitleEl.innerHTML = dict.auth_subtitle_login;
        groupName.classList.add('hidden');
        submitText.innerHTML = dict.auth_btn_login;
        forgotWrapper.style.display = 'block';
      } else {
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
        titleEl.innerHTML = dict.auth_title_register;
        subtitleEl.innerHTML = dict.auth_subtitle_register;
        groupName.classList.remove('hidden');
        submitText.innerHTML = dict.auth_btn_register;
        forgotWrapper.style.display = 'none';
      }
      updateSubmitEnabled();
    }

    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    togglePassword.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      function getEyeSvg(open = true) {
        if (open) {
          return `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          `;
        }
        return `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a20.2 20.2 0 0 1 5.06-6.94"></path>
            <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a20.2 20.2 0 0 1-3.17 4.23"></path>
            <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"></path>
            <path d="M1 1l22 22"></path>
          </svg>
        `;
      }

      togglePassword.innerHTML = getEyeSvg(!isPassword);
      const dict = translations[currentLang];
      togglePassword.setAttribute("aria-label", isPassword ? dict.auth_show_password : dict.auth_hide_password);

    });

    function setSubmitLoading(isLoading) {
      if (!submitBtn) return;

      __authSubmitting = isLoading;
      submitBtn.classList.toggle('is-loading', isLoading);
      submitBtn.disabled = isLoading;

      // Spinner visible solo en loading
      if (submitSpinner) {
        submitSpinner.classList.toggle('hidden', !isLoading);
      }
    }

    function computeAuthIsValid() {
      // Si ya tienes validateEmail/validatePassword/validateName: úsalo
      const email = (emailInput?.value || '').trim();
      const pass = (passwordInput?.value || '').trim();
      const name = (nameInput?.value || '').trim();

      if (!email) return false;
      if (!pass) return false;

      // Validación simple de email (UI)
      const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!okEmail) return false;

      // Password mínimo (coherente con tu regla de 4)
      if (pass.length < 4) return false;

      // Register requiere name >= 2
      if (mode === 'register' && name.length < 2) return false;

      return true;
    }

    function updateSubmitEnabled() {
      if (!submitBtn) return;
      if (__authSubmitting) return; // si está enviando, no tocamos

      const ok = computeAuthIsValid();
      submitBtn.disabled = !ok;
    }

    emailInput?.addEventListener('input', updateSubmitEnabled);
    passwordInput?.addEventListener('input', updateSubmitEnabled);
    nameInput?.addEventListener('input', updateSubmitEnabled);

    // Cuando cambias de modo (login/register), recalculamos

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (__authSubmitting) return;

      // Si no es válido, no hacemos submit
      updateSubmitEnabled();
      if (submitBtn?.disabled) return;

      // Limpiar error general
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }

      setSubmitLoading(true);

      // Texto “Cargando…” según idioma + modo
      const dict = translations[currentLang];
      const loadingText = mode === 'login'
        ? dict.auth_loading_login
        : dict.auth_loading_register;

      const prevText = submitText?.textContent || '';
      if (submitText) submitText.textContent = loadingText;

      try {
        // Llamada real a ApiClient (local o http según transport)
        // DEV server (3000): fuerza HTTP + /api antes de login/register
        try {
          const isNodeServer = String(window.location.port) === "3000";
          if (isNodeServer) {
            if (window.ApiClient?.setBaseUrl) ApiClient.setBaseUrl("/api");
            if (window.ApiClient?.setTransport) ApiClient.setTransport("http");
          }
        } catch (_) {}
        const email = emailInput?.value.trim();
        const password = passwordInput?.value.trim();
        const name = nameInput?.value.trim();

        if (mode === 'login') {
          await ApiClient.login(email, password);
        } else {
          await ApiClient.register(email, password, name);
        }

        // Guardamos configuración de conexión (NO datos, NO tokens)
        try {
          sessionStorage.setItem("quacker_transport", ApiClient.getTransportInfo().transport);
          sessionStorage.setItem("quacker_baseUrl", ApiClient.getTransportInfo().baseUrl);
        } catch (_) {}

        // CLAVE: confirmar que la cookie de sesión ya está activa ANTES de navegar
        let session = null;
        try {
          session = await ApiClient.getCurrentSession();
        } catch (_) {
          session = null;
        }

        if (!session || !session.user) {
          // No navegamos si la sesión no está viva (evita “flash + expulsión”)
          const msg = currentLang === 'es'
            ? "No se pudo validar la sesión. Reintenta. Si sigue pasando, abre Quacker siempre desde el mismo host (127.0.0.1 o localhost)."
            : "Couldn’t validate the session. Try again. If it persists, always open Quacker from the same host (127.0.0.1 or localhost).";

          if (errorEl) {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
          }

          if (window.toast) {
            window.toast({
              title: currentLang === 'es' ? "Sesión no válida" : "Session not valid",
              message: msg,
              type: "error",
              duration: 4200
            });
          }

          // Restaurar texto + liberar loading
          if (submitText) submitText.textContent = prevText;
          setSubmitLoading(false);
          return;
        }

        // OK: sesión viva => navegamos
        window.location.assign("dashboard.html");
      } catch (err) {
        console.error(err);

        const isRegister = mode === 'register';
        const errorCode = String(err?.error || err?.message || "").trim();

        let msg = currentLang === 'es'
          ? "No se pudo iniciar sesión. Revisa email/contraseña y vuelve a intentarlo."
          : "Couldn’t sign in. Check your email/password and try again.";

        if (isRegister) {
          msg = errorCode === "email_exists"
            ? (currentLang === 'es'
                ? "Ya existe una cuenta con ese email."
                : "An account with that email already exists.")
            : (currentLang === 'es'
                ? "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo."
                : "Couldn’t create the account. Check your details and try again.");
        }

        if (errorEl) {
          errorEl.textContent = msg;
          errorEl.classList.remove('hidden');
        }

        if (submitText) submitText.textContent = prevText;
        setSubmitLoading(false);
      }
    });

    /* ---------- Init: idioma + tema ---------- */

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    const savedLang = localStorage.getItem('quacker_lang') ||
      (navigator.language && navigator.language.startsWith('es') ? 'es' : 'en');
    setLanguage(savedLang);

    const savedTheme = localStorage.getItem('quacker_theme') || 'light';
    applyTheme(savedTheme);