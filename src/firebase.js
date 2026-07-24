import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDX6w6f4NZIN0aNc09zLPPo4_tzjJiP_b8",
  authDomain: "rider-tracker-e1898.firebaseapp.com",
  projectId: "rider-tracker-e1898",
  storageBucket: "rider-tracker-e1898.firebasestorage.app",
  messagingSenderId: "1055971366451",
  appId: "1:1055971366451:web:cb5b4354f40f64433fb546",
  measurementId: "G-J9MCHTMC91"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
