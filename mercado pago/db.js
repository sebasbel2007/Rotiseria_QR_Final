// File: plataforma cursos SyM/assets/js/db.js

import { db } from '../../firebase/firebase-config.js';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query,
  where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ════════════════════════════════════════════════════════════
// USUARIOS
// ════════════════════════════════════════════════════════════

export async function createUserDoc(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp()
  });
}

export async function getUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserData(uid, data) {
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
}

export async function upgradeToTeacher(uid) {
  await updateDoc(doc(db, 'users', uid), {
    role: 'teacher',
    membershipStatus: 'active',
    membershipPaidAt: serverTimestamp()
  });
}

export async function suspendUser(uid, reason) {
  await updateDoc(doc(db, 'users', uid), {
    suspended: true,
    suspendedReason: reason
  });
}

export async function reactivateUser(uid) {
  await updateDoc(doc(db, 'users', uid), {
    suspended: false,
    suspendedReason: null
  });
}

export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ════════════════════════════════════════════════════════════
// CURSOS
// ════════════════════════════════════════════════════════════

export async function createCourse(teacherId, teacherName, data) {
  const ref = await addDoc(collection(db, 'courses'), {
    ...data,
    teacherId,
    teacherName,
    status: 'draft',
    rating: 0,
    totalRatings: 0,
    totalStudents: 0,
    rejectionReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getCourse(courseId) {
  const snap = await getDoc(doc(db, 'courses', courseId));
  return snap.exists() ? { courseId: snap.id, ...snap.data() } : null;
}

export async function updateCourse(courseId, data) {
  await updateDoc(doc(db, 'courses', courseId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function submitCourseForReview(courseId) {
  await updateDoc(doc(db, 'courses', courseId), {
    status: 'pending',
    updatedAt: serverTimestamp()
  });
}

export async function approveCourse(courseId) {
  await updateDoc(doc(db, 'courses', courseId), {
    status: 'published',
    rejectionReason: null,
    updatedAt: serverTimestamp()
  });
}

export async function rejectCourse(courseId, reason) {
  await updateDoc(doc(db, 'courses', courseId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp()
  });
}

export async function getPublishedCourses(filters = {}) {
  let q = query(
    collection(db, 'courses'),
    where('status', '==', 'published'),
    orderBy('createdAt', 'desc')
  );
  if (filters.category) {
    q = query(collection(db, 'courses'),
      where('status', '==', 'published'),
      where('category', '==', filters.category),
      orderBy('createdAt', 'desc')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ courseId: d.id, ...d.data() }));
}

export async function getCoursesByTeacher(teacherId) {
  const q = query(
    collection(db, 'courses'),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ courseId: d.id, ...d.data() }));
}

export async function getPendingCourses() {
  const q = query(
    collection(db, 'courses'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ courseId: d.id, ...d.data() }));
}

// Todos los cursos (cualquier estado), para el panel admin "Cursos".
export async function getAllCourses() {
  const q = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ courseId: d.id, ...d.data() }));
}

// Archiva un curso publicado (status 'removed'). Los alumnos conservan el acceso.
export async function archiveCourse(courseId) {
  await updateDoc(doc(db, 'courses', courseId), {
    status: 'removed',
    removedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// Borra el curso completo: doc + subcolecciones (módulos, quiz, examen,
// clases/comentarios y foro).
export async function deleteCourse(courseId) {
  // Módulos (y su quiz)
  const modules = await getModules(courseId);
  for (const mod of modules) {
    await deleteDoc(doc(db, 'courses', courseId, 'modules', mod.moduleId, 'quiz', 'quiz')).catch(() => {});
    await deleteDoc(doc(db, 'courses', courseId, 'modules', mod.moduleId)).catch(() => {});
  }
  // Examen final
  await deleteDoc(doc(db, 'courses', courseId, 'finalExam', 'exam')).catch(() => {});
  // Clases (comentarios)
  const lessonsSnap = await getDocs(collection(db, 'courses', courseId, 'lessons'));
  for (const l of lessonsSnap.docs) {
    const commentsSnap = await getDocs(collection(db, 'courses', courseId, 'lessons', l.id, 'comments'));
    for (const c of commentsSnap.docs) await deleteDoc(c.ref);
    await deleteDoc(l.ref);
  }
  // Foro
  const forumSnap = await getDocs(collection(db, 'courses', courseId, 'forum'));
  for (const f of forumSnap.docs) await deleteDoc(f.ref);
  // Curso
  await deleteDoc(doc(db, 'courses', courseId));
}

// Limpia las URLs de multimedia de un curso (mini, promo y videos de clase).
// Se usa tras rechazar/borrar en Cloudinary: el profe re-subirá los archivos.
export async function clearCourseMediaUrls(courseId) {
  await updateDoc(doc(db, 'courses', courseId), {
    thumbnailURL: '',
    promoVideoURL: '',
    updatedAt: serverTimestamp()
  });
  const modules = await getModules(courseId);
  for (const mod of modules) {
    if (mod.lessons?.length) {
      const lessons = mod.lessons.map(l => ({ ...l, videoURL: '' }));
      await updateModule(courseId, mod.moduleId, { lessons });
    }
  }
}

// ════════════════════════════════════════════════════════════
// MÓDULOS Y CLASES
// ════════════════════════════════════════════════════════════

export async function saveModule(courseId, moduleData) {
  const ref = doc(collection(db, 'courses', courseId, 'modules'));
  await setDoc(ref, { ...moduleData, moduleId: ref.id });
  return ref.id;
}

export async function updateModule(courseId, moduleId, data) {
  await updateDoc(doc(db, 'courses', courseId, 'modules', moduleId), data);
}

export async function deleteModule(courseId, moduleId) {
  await deleteDoc(doc(db, 'courses', courseId, 'modules', moduleId));
}

export async function getModules(courseId) {
  const q = query(
    collection(db, 'courses', courseId, 'modules'),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ moduleId: d.id, ...d.data() }));
}

export async function saveQuiz(courseId, moduleId, quizData) {
  await setDoc(doc(db, 'courses', courseId, 'modules', moduleId, 'quiz', 'quiz'), quizData);
}

export async function getQuiz(courseId, moduleId) {
  const snap = await getDoc(doc(db, 'courses', courseId, 'modules', moduleId, 'quiz', 'quiz'));
  return snap.exists() ? snap.data() : null;
}

export async function saveFinalExam(courseId, examData) {
  await setDoc(doc(db, 'courses', courseId, 'finalExam', 'exam'), examData);
}

export async function getFinalExam(courseId) {
  const snap = await getDoc(doc(db, 'courses', courseId, 'finalExam', 'exam'));
  return snap.exists() ? snap.data() : null;
}

// ════════════════════════════════════════════════════════════
// INSCRIPCIONES Y PROGRESO
// ════════════════════════════════════════════════════════════

export async function createEnrollment(studentId, courseId, teacherId, pricePaid, paymentId, totalModules) {
  const enrollId = `${studentId}_${courseId}`;
  await setDoc(doc(db, 'enrollments', enrollId), {
    studentId,
    courseId,
    teacherId,
    enrolledAt: serverTimestamp(),
    pricePaid,
    paymentId,
    completedModules: [],
    completedLessons: [],
    quizResults: {},
    examResult: null,
    certificateIssued: false,
    certificateIssuedAt: null,
    progressPercent: 0,
    refundEligible: true,
    refundRequested: false
  });
  await updateDoc(doc(db, 'courses', courseId), {
    totalStudents: increment(1)
  });
}

export async function getEnrollment(studentId, courseId) {
  const snap = await getDoc(doc(db, 'enrollments', `${studentId}_${courseId}`));
  return snap.exists() ? snap.data() : null;
}

export async function getStudentEnrollments(studentId) {
  const q = query(
    collection(db, 'enrollments'),
    where('studentId', '==', studentId),
    orderBy('enrolledAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getEnrollmentsByCourse(courseId) {
  const q = query(
    collection(db, 'enrollments'),
    where('courseId', '==', courseId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function completeLesson(studentId, courseId, lessonId) {
  const ref = doc(db, 'enrollments', `${studentId}_${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.completedLessons.includes(lessonId)) return;

  await updateDoc(ref, {
    completedLessons: [...data.completedLessons, lessonId]
  });
}

export async function completeModule(studentId, courseId, moduleId, totalModules) {
  const ref = doc(db, 'enrollments', `${studentId}_${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  if (data.completedModules.includes(moduleId)) return;

  const newCompleted = [...data.completedModules, moduleId];
  const progressPercent = Math.round((newCompleted.length / totalModules) * 100);
  const refundEligible = progressPercent < 50;

  await updateDoc(ref, {
    completedModules: newCompleted,
    progressPercent,
    refundEligible
  });
}

export async function saveQuizResult(studentId, courseId, moduleId, passed, score) {
  const ref = doc(db, 'enrollments', `${studentId}_${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const prev = snap.data().quizResults || {};
  const attempts = (prev[moduleId]?.attempts || 0) + 1;

  await updateDoc(ref, {
    [`quizResults.${moduleId}`]: { passed, score, attempts }
  });
}

export async function saveExamResult(studentId, courseId, passed, score) {
  const ref = doc(db, 'enrollments', `${studentId}_${courseId}`);
  await updateDoc(ref, {
    examResult: { passed, score, completedAt: serverTimestamp() },
    ...(passed ? { certificateIssued: true, certificateIssuedAt: serverTimestamp() } : {})
  });
}

export async function requestRefund(studentId, courseId) {
  const ref = doc(db, 'enrollments', `${studentId}_${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const data = snap.data();
  if (!data.refundEligible) return false;

  await updateDoc(ref, { refundRequested: true });
  return true;
}

// ════════════════════════════════════════════════════════════
// TRANSACCIONES
// ════════════════════════════════════════════════════════════

export async function createTransaction(data) {
  const ref = await addDoc(collection(db, 'transactions'), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getTransactionsByTeacher(teacherId) {
  const q = query(
    collection(db, 'transactions'),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAllTransactions() {
  const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateTransactionStatus(transactionId, status) {
  await updateDoc(doc(db, 'transactions', transactionId), {
    status,
    updatedAt: serverTimestamp()
  });
}

// ════════════════════════════════════════════════════════════
// RESEÑAS
// ════════════════════════════════════════════════════════════

export async function saveReview(studentId, courseId, teacherId, rating, comment) {
  const reviewId = `${studentId}_${courseId}`;
  await setDoc(doc(db, 'reviews', reviewId), {
    studentId, courseId, teacherId, rating, comment,
    createdAt: serverTimestamp()
  });

  // Recalcular rating promedio del curso
  const q = query(collection(db, 'reviews'), where('courseId', '==', courseId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => d.data());
  const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;

  await updateDoc(doc(db, 'courses', courseId), {
    rating: Math.round(avg * 10) / 10,
    totalRatings: reviews.length
  });
}

export async function getCourseReviews(courseId) {
  const q = query(
    collection(db, 'reviews'),
    where('courseId', '==', courseId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function getAllReviews() {
  const snap = await getDocs(collection(db, 'reviews'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteReview(reviewId, courseId) {
  await deleteDoc(doc(db, 'reviews', reviewId));

  const q = query(collection(db, 'reviews'), where('courseId', '==', courseId));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => d.data());

  if (reviews.length) {
    const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length;
    await updateDoc(doc(db, 'courses', courseId), {
      rating: Math.round(avg * 10) / 10,
      totalRatings: reviews.length
    });
  } else {
    await updateDoc(doc(db, 'courses', courseId), { rating: 0, totalRatings: 0 });
  }
}

// ════════════════════════════════════════════════════════════
// COMENTARIOS POR CLASE
// ════════════════════════════════════════════════════════════

export async function addComment(courseId, lessonId, authorId, authorName, authorRole, text, parentId = null) {
  await addDoc(collection(db, 'courses', courseId, 'lessons', lessonId, 'comments'), {
    authorId, authorName, authorRole, text, parentId,
    createdAt: serverTimestamp()
  });
}

export function listenComments(courseId, lessonId, callback) {
  const q = query(
    collection(db, 'courses', courseId, 'lessons', lessonId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════════════════════════
// FORO DEL CURSO
// ════════════════════════════════════════════════════════════

export async function addForumPost(courseId, authorId, authorName, authorRole, title, text) {
  await addDoc(collection(db, 'courses', courseId, 'forum'), {
    authorId, authorName, authorRole, title, text,
    replies: [],
    createdAt: serverTimestamp()
  });
}

export async function addForumReply(courseId, postId, authorId, authorName, text) {
  const ref = doc(db, 'courses', courseId, 'forum', postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const replies = snap.data().replies || [];
  await updateDoc(ref, {
    replies: [...replies, {
      authorId, authorName, text,
      createdAt: new Date().toISOString()
    }]
  });
}

export async function getForumPosts(courseId) {
  const q = query(
    collection(db, 'courses', courseId, 'forum'),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ════════════════════════════════════════════════════════════
// NOTIFICACIONES
// ════════════════════════════════════════════════════════════

export async function createNotification(userId, type, title, message, relatedCourseId = null, relatedTransactionId = null) {
  await addDoc(collection(db, 'notifications'), {
    userId, type, title, message,
    read: false,
    relatedCourseId,
    relatedTransactionId,
    createdAt: serverTimestamp()
  });
}

// Última suscripción gana por userId: evita duplicar listeners cuando el
// router SPA re-ejecuta los scripts de una página de dashboard.
const _notifUnsubs = {};

export function listenNotifications(userId, callback) {
  if (_notifUnsubs[userId]) { _notifUnsubs[userId](); _notifUnsubs[userId] = null; }
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  _notifUnsubs[userId] = onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
  return _notifUnsubs[userId];
}

export async function markNotificationRead(notifId) {
  await updateDoc(doc(db, 'notifications', notifId), { read: true });
}

export async function markAllNotificationsRead(userId) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function deleteNotification(notifId) {
  await deleteDoc(doc(db, 'notifications', notifId));
}

// Notificaciones recientes de un usuario (para filtrar solicitudes admin).
export async function getAdminNotifications(limitCount = 50) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', 'admin'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ════════════════════════════════════════════════════════════
// CATEGORÍAS Y ETIQUETAS
// ════════════════════════════════════════════════════════════

export async function createCategory(name, createdBy) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const status = createdBy === 'admin' ? 'approved' : 'pending';
  await addDoc(collection(db, 'categories'), {
    name, slug, createdBy,
    status,
    createdAt: serverTimestamp()
  });
}

export async function getCategories(statusFilter = 'approved') {
  let q = query(
    collection(db, 'categories'),
    where('status', '==', statusFilter),
    orderBy('name', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingCategories() {
  return getCategories('pending');
}

export async function approveCategory(categoryId) {
  await updateDoc(doc(db, 'categories', categoryId), {
    status: 'approved',
    updatedAt: serverTimestamp()
  });
}

export async function rejectCategory(categoryId, reason) {
  await updateDoc(doc(db, 'categories', categoryId), {
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: serverTimestamp()
  });
}

export async function updateCategory(categoryId, name) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await updateDoc(doc(db, 'categories', categoryId), {
    name,
    slug,
    updatedAt: serverTimestamp()
  });
}

export async function deleteCategory(categoryId) {
  await deleteDoc(doc(db, 'categories', categoryId));
}

export async function getAllCategories() {
  const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createTag(name, createdBy) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await addDoc(collection(db, 'tags'), {
    name, slug, createdBy,
    createdAt: serverTimestamp()
  });
}

export async function getTags() {
  const snap = await getDocs(query(collection(db, 'tags'), orderBy('name', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateUserRole(uid, newRole) {
  await updateDoc(doc(db, 'users', uid), {
    role: newRole,
    updatedAt: serverTimestamp()
  });
}

export const ADMIN_UID = '9IztY8OndFQjnCqJEdxlTGzh7u52';
