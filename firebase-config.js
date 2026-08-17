import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Suas chaves reais do projeto LavaFacil
const firebaseConfig = {
  apiKey: "AIzaSyACkWX6JUBzGWVPD_oeSLTBTUG0vD5K4Ek",
  authDomain: "lavafacil-f16ad.firebaseapp.com",
  projectId: "lavafacil-f16ad",
  storageBucket: "lavafacil-f16ad.firebasestorage.app",
  messagingSenderId: "783381084668",
  appId: "1:783381084668:web:e9630336eb1c85ef9c5a79",
  measurementId: "G-SL0EZZZWHJ"
};

// Inicializando os serviços
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
