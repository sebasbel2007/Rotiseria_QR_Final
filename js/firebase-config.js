// js/firebase-config.js
// Firebase se carga via CDN compat en index.html
// Este archivo solo inicializa la app y expone db y auth como globales

const firebaseConfig = {
  apiKey: "AIzaSyBA-zdO-3nqKnGzUCGYU3Squ5ik9nwIesA",
  authDomain: "rotiseria-qr.firebaseapp.com",
  projectId: "rotiseria-qr",
  storageBucket: "rotiseria-qr.firebasestorage.app",
  messagingSenderId: "437865639107",
  appId: "1:437865639107:web:491e6901e0bcccf5770676",
  measurementId: "G-ENSLRZ2H1P"
};

firebase.initializeApp(firebaseConfig);

// Globales disponibles para todos los scripts
const db   = firebase.firestore();
const auth = firebase.auth();
