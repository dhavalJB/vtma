// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA9XMjr3m5GksUtrWGttoK62QQRBLYpzxI",
  authDomain: "testing-86947.firebaseapp.com",
  projectId: "testing-86947",
  storageBucket: "testing-86947.firebasestorage.app",
  messagingSenderId: "319465715582",
  appId: "1:319465715582:web:5192820613dbc58729a52f",
  measurementId: "G-FRXG4B23HP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
