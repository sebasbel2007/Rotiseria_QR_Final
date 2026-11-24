// File: plataforma cursos SyM/assets/js/payments.js
// Mercado Pago — Checkout Pro (Sandbox)

import { createEnrollment, createTransaction, upgradeToTeacher, createNotification } from './db.js';
import { showToast } from './app.js';

const PLATFORM_COMMISSION = 0.30;
const TEACHER_SHARE       = 0.70;
const MEMBERSHIP_PRICE    = 20000; // ARS

// ─── Crear preferencia via servidor local ────────────────────
export async function createPreference(type, data) {
  const res = await fetch('/api/create-preference', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ type, ...data })
  });

  if (!res.ok) {
    const err = await res.json();
    console.error('Error al crear preferencia:', err);
    throw new Error(err.error || 'No se pudo crear la preferencia de pago.');
  }

  return res.json();
}

// ─── Procesar pago aprobado de membresía ──────────────────────
export async function processMembershipPayment(userId, paymentId) {
  await upgradeToTeacher(userId);

  await createTransaction({
    type: 'membership',
    studentId: userId,
    teacherId: null,
    courseId: null,
    amount: MEMBERSHIP_PRICE,
    platformAmount: MEMBERSHIP_PRICE,
    teacherAmount: 0,
    paymentId,
    status: 'completed'
  });

  await createNotification(
    userId,
    'enrollment',
    '¡Bienvenido, Profesor!',
    'Tu membresía fue activada. Ya podés crear y publicar cursos.'
  );
}

// ─── Procesar pago aprobado de curso ──────────────────────────
export async function processCoursePayment(studentId, courseId, teacherId, price, paymentId, totalModules) {
  const platformAmount = Math.round(price * PLATFORM_COMMISSION);
  const teacherAmount  = Math.round(price * TEACHER_SHARE);

  await createEnrollment(studentId, courseId, teacherId, price, paymentId, totalModules);

  const transactionId = await createTransaction({
    type: 'course_purchase',
    studentId,
    teacherId,
    courseId,
    amount: price,
    platformAmount,
    teacherAmount,
    paymentId,
    status: 'completed'
  });

  // Notificación al alumno
  await createNotification(
    studentId,
    'enrollment',
    '¡Compra exitosa!',
    'Ya podés acceder al curso desde tu dashboard.',
    courseId,
    transactionId
  );

  // Notificación al profesor
  await createNotification(
    teacherId,
    'sale',
    'Nueva venta',
    `Alguien compró tu curso. Ganaste $${teacherAmount.toLocaleString('es-AR')} ARS.`,
    courseId,
    transactionId
  );
}

// ─── Renderizar botón Checkout Pro ───────────────────────────
export async function renderCheckoutButton(containerId, preferenceId, initPoint) {
  // Checkout Pro: redirige a la URL de pago de MP
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <a href="${initPoint}" id="mp-checkout-btn"
      style="
        display:flex;align-items:center;justify-content:center;gap:.75rem;
        width:100%;padding:1rem 1.5rem;
        background:#009ee3;color:#fff;
        border-radius:var(--radius-md);
        font-size:1rem;font-weight:700;
        text-decoration:none;
        transition:background .2s;
      "
      onmouseover="this.style.background='#007bbf'"
      onmouseout="this.style.background='#009ee3'"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 48 48" fill="white">
        <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm0 36c-8.82 0-16-7.18-16-16S15.18 8 24 8s16 7.18 16 16-7.18 16-16 16zm-2-22h4v12h-4zm0-6h4v4h-4z"/>
      </svg>
      Pagar con Mercado Pago
    </a>
    <p style="font-size:.75rem;color:var(--text-muted);text-align:center;margin-top:.75rem;">
      Serás redirigido al ambiente seguro de Mercado Pago.
    </p>`;
}
