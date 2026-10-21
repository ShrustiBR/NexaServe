// =====================================================
// PASTE YOUR FIREBASE CONFIG HERE
// Get this from: Firebase Console → Project Settings → General → Your apps → SDK setup and configuration
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
// Storage import removed — using Base64 (Option B) instead, no Blaze plan needed

const firebaseConfig = {
  apiKey: "AIzaSyCOrKFZEBFDkv8CS4qVKSqNAAssuP0piIY",
  authDomain: "nexaserve-3144b.firebaseapp.com",
  projectId: "nexaserve-3144b",
  storageBucket: "nexaserve-3144b.firebasestorage.app",
  messagingSenderId: "495090786279",
  appId: "1:495090786279:web:6c43c3db71b655c565a742",
  measurementId: "G-BH97WJCR6Z"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
