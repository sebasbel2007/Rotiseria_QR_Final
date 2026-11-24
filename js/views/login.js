// js/views/login.js
(() => {

  function renderizarLogin(mensajePrevio = null) {
    if (obtenerUsuarioActual()) { renderizarCliente(); return; }

    document.getElementById('app').innerHTML = `
      <div class="login-wrap">
        <div class="login-card">

          <div class="login-card__brand">
            <div class="login-brand-icon">🍗</div>
            <h1 class="login-card__title">Rotisería SYM</h1>
            <p class="login-card__subtitle">Bienvenido, ingresá para continuar</p>
          </div>

          ${mensajePrevio ? `<div class="login-alert">${mensajePrevio}</div>` : ''}

          <div class="tabs" id="login-tabs">
            <button class="tab-btn tab-btn--active" data-tab="ingresar" onclick="switchLoginTab('ingresar')">Iniciar Sesión</button>
            <button class="tab-btn" data-tab="registrar" onclick="switchLoginTab('registrar')">Registrarse</button>
          </div>

          <div class="tab-panel tab-panel--active" id="tab-ingresar">
            <form class="login-form" id="form-login" onsubmit="handleLogin(event)">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" type="email" id="login-email" placeholder="tu@email.com" required />
              </div>
              <div class="form-group">
                <label class="form-label">Contraseña</label>
                <input class="form-input" type="password" id="login-pass" placeholder="••••••••" required />
              </div>
              <p class="form-error" id="login-error"></p>
              <button class="btn btn--primary btn--full" type="submit" id="login-btn">Ingresar</button>
            </form>
          </div>

          <div class="tab-panel" id="tab-registrar">
            <form class="login-form" id="form-registro" onsubmit="handleRegistro(event)">
              <div class="form-group">
                <label class="form-label">Nombre</label>
                <input class="form-input" type="text" id="reg-nombre" placeholder="Tu nombre" required />
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-input" type="email" id="reg-email" placeholder="tu@email.com" required />
              </div>
              <div class="form-group">
                <label class="form-label">Contraseña</label>
                <input class="form-input" type="password" id="reg-pass" placeholder="Mínimo 6 caracteres" required />
              </div>
              <p class="form-error" id="reg-error"></p>
              <button class="btn btn--primary btn--full" type="submit" id="reg-btn">Crear cuenta</button>
            </form>
          </div>

          <div class="login-divider"><span>o</span></div>

          <button class="btn btn--google btn--full" onclick="handleGoogle()">
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
            Continuar con Google
          </button>

        </div>
      </div>`;
  }

  function switchLoginTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('tab-panel--active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('tab-btn--active');
    document.getElementById(`tab-${tab}`).classList.add('tab-panel--active');
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const btn   = document.getElementById('login-btn');
    const err   = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'Ingresando...';
    err.textContent = '';

    try {
      await loginEmail(email, pass);
    } catch (error) {
      err.textContent = traducirErrorAuth(error.code);
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  }

  async function handleRegistro(e) {
    e.preventDefault();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email  = document.getElementById('reg-email').value.trim();
    const pass   = document.getElementById('reg-pass').value;
    const btn    = document.getElementById('reg-btn');
    const err    = document.getElementById('reg-error');

    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';
    err.textContent = '';

    try {
      await registrarEmail(email, pass, nombre);
    } catch (error) {
      err.textContent = traducirErrorAuth(error.code);
      btn.disabled = false;
      btn.textContent = 'Crear cuenta';
    }
  }

  async function handleGoogle() {
    try {
      await loginGoogle();
    } catch (error) {
      mostrarToast(traducirErrorAuth(error.code), 'error');
    }
  }

  window.renderizarLogin  = renderizarLogin;
  window.switchLoginTab   = switchLoginTab;
  window.handleLogin      = handleLogin;
  window.handleRegistro   = handleRegistro;
  window.handleGoogle     = handleGoogle;

})();
