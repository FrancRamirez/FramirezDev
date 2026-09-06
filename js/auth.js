// js/auth.js
//
// Helpers compartidos entre login.html, registro.html y dashboard.html
// para hablar con /api/auth/*. Todas las requests van con
// credentials: 'include' para que el navegador mande/reciba la cookie
// httpOnly de sesión.

const AuthAPI = {
  async register(username, password) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    return { ok: res.ok, data: await res.json() };
  },

  async login(username, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    });
    return { ok: res.ok, data: await res.json() };
  },

  async logout() {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return { ok: res.ok, data: await res.json() };
  },

  async me() {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  },
};

window.AuthAPI = AuthAPI;
