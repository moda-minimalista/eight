import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBC4uWEb3Vooe8f9eNiNaVZl47Cccp3u8s",
  authDomain: "eight-e1db2.firebaseapp.com",
  projectId: "eight-e1db2",
  storageBucket: "eight-e1db2.firebasestorage.app",
  messagingSenderId: "814219871326",
  appId: "1:814219871326:web:2320378064a82d00bee0cf",
  measurementId: "G-EN9ZS5SZRG"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

await setPersistence(auth, browserLocalPersistence);

