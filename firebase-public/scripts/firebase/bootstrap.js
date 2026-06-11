import * as authService from "./auth-service.js";
import * as firestoreService from "./firestore-service.js";
import * as storageService from "./storage-service.js";
import * as catalogMigration from "./catalog-migration.js";
import * as accessService from "./access-service.js";
import * as setupService from "./setup-service.js";

const firebase = {
  auth: authService,
  firestore: firestoreService,
  storage: storageService,
  migration: catalogMigration,
  access: accessService,
  setup: setupService,
  ready: true
};

window.EIGHT_FIREBASE = firebase;
window.dispatchEvent(new CustomEvent("eight:firebase-ready", { detail: firebase }));

