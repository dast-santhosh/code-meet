// Firebase Configuration for DevShaala Code & Meet
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyAKLmBYyEJMHiTcL7T1O4asErBv5ncCuC0",
    authDomain: "apex-code-labs.firebaseapp.com",
    projectId: "apex-code-labs",
    storageBucket: "apex-code-labs.firebasestorage.app",
    messagingSenderId: "98765885664",
    appId: "1:98765885664:web:4aa13742b5c269fe588085",
    measurementId: "G-3QNKWQQZFG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
