import {
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { auth, db } from "./config.js";

export async function isSetupComplete() {
  const snapshot = await getDoc(doc(db, "configuracoes", "bootstrap"));
  return snapshot.exists();
}

export async function createFirstAdmin({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  let createdUser = null;

  try {
    const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    createdUser = credential.user;
    await updateProfile(createdUser, { displayName: name.trim() });

    const batch = writeBatch(db);
    batch.set(doc(db, "usuarios", createdUser.uid), {
      nome: name.trim(),
      email: normalizedEmail,
      role: "admin",
      ativo: true,
      primeiroAdministrador: true,
      dataCriacao: serverTimestamp(),
      dataAtualizacao: serverTimestamp()
    });
    batch.set(doc(db, "configuracoes", "bootstrap"), {
      concluido: true,
      adminUid: createdUser.uid,
      dataCriacao: serverTimestamp()
    });
    await batch.commit();
    return createdUser.uid;
  } catch (error) {
    if (createdUser) {
      await deleteUser(createdUser).catch(() => {});
      await signOut(auth).catch(() => {});
    }
    throw error;
  }
}
