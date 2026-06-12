import { deleteApp, initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db, firebaseConfig } from "./config.js";

function accessUser(snapshot) {
  const data = snapshot.data();
  return {
    uid: snapshot.id,
    name: data.nome || "Usuário EIGHT",
    email: data.email || "",
    role: data.role || "cliente",
    active: data.ativo !== false,
    createdAt: data.dataCriacao || null
  };
}

export async function listAccessUsers() {
  const snapshot = await getDocs(collection(db, "usuarios"));
  return snapshot.docs
    .map(accessUser)
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
}

export async function createAdminAccess({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const secondaryApp = initializeApp(firebaseConfig, `eight-access-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  let createdUser = null;

  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, normalizedEmail, password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName: name.trim() });
    await setDoc(doc(db, "usuarios", createdUser.uid), {
      nome: name.trim(),
      email: normalizedEmail,
      role: "admin",
      ativo: true,
      criadoPor: auth.currentUser.uid,
      dataCriacao: serverTimestamp(),
      dataAtualizacao: serverTimestamp()
    });
    return createdUser.uid;
  } catch (error) {
    if (createdUser) await deleteUser(createdUser).catch(() => {});
    throw error;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
}

export async function updateUserAccess(uid, { role, active }) {
  if (uid === auth.currentUser?.uid && (role !== "admin" || !active)) {
    throw new Error("Você não pode remover ou bloquear o próprio acesso administrativo.");
  }
  await updateDoc(doc(db, "usuarios", uid), {
    role,
    ativo: Boolean(active),
    atualizadoPor: auth.currentUser.uid,
    dataAtualizacao: serverTimestamp()
  });
}

export async function sendAccessPasswordReset(email) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}
