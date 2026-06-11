import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db } from "./config.js";

function publicUser(user, profile = null) {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: profile?.role || "cliente",
    active: profile?.ativo !== false
  };
}

async function getProfile(uid) {
  const snapshot = await getDoc(doc(db, "usuarios", uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function register({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  await setDoc(doc(db, "usuarios", credential.user.uid), {
    nome: name,
    email,
    role: "cliente",
    ativo: true,
    dataCriacao: serverTimestamp(),
    dataAtualizacao: serverTimestamp()
  });
  return publicUser(credential.user, { role: "cliente" });
}

export async function login({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getProfile(credential.user.uid);
  if (profile?.ativo === false) {
    await signOut(auth);
    const error = new Error("Este acesso foi bloqueado pelo administrador.");
    error.code = "auth/user-disabled-by-admin";
    throw error;
  }
  return publicUser(credential.user, profile);
}

export async function logout() {
  await signOut(auth);
}

export async function recoverPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export function observeSession(callback) {
  return onAuthStateChanged(auth, async user => {
    if (!user) {
      callback(null);
      return;
    }
    try {
      const profile = await getProfile(user.uid);
      if (profile?.ativo === false) {
        await signOut(auth);
        callback(null);
        return;
      }
      callback(publicUser(user, profile));
    } catch {
      callback(publicUser(user));
    }
  });
}

export function currentUser() {
  return auth.currentUser;
}

export async function refreshCurrentUser() {
  if (!auth.currentUser) return null;
  return publicUser(auth.currentUser, await getProfile(auth.currentUser.uid));
}

export async function isAdmin() {
  if (!auth.currentUser) return false;
  const profile = await getProfile(auth.currentUser.uid);
  return profile?.role === "admin" && profile?.ativo !== false;
}

