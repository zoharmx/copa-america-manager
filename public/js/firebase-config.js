// firebase-config.js
// Configuración pública de Firebase. Estos valores SON seguros de exponer
// (la seguridad real la dan las reglas de Firestore, no esconder el apiKey).
//
// En Vercel, define las variables de entorno en el dashboard y se inyectan
// vía el placeholder window.__FIREBASE_CONFIG__ (ver vercel.json / index.html).
// En local, puedes pegar aquí directamente tu config para probar.

(function () {
  // Si el HTML inyectó window.__FIREBASE_CONFIG__ (producción), úsalo.
  // Si no, intenta cargar de localStorage (modo dev) y, como último recurso,
  // usa un objeto vacío para que la app siga funcionando offline.
  let config = window.__FIREBASE_CONFIG__;

  if (!config) {
    try {
      const fromLS = localStorage.getItem('firebase_config');
      if (fromLS) config = JSON.parse(fromLS);
    } catch (e) {
      /* ignore */
    }
  }

  if (!config || !config.apiKey) {
    console.warn(
      '[Firebase] No hay configuración. La app funcionará en modo local ' +
      '(sin persistencia). Configura window.__FIREBASE_CONFIG__ o define ' +
      'localStorage.setItem("firebase_config", JSON.stringify({...}))'
    );
    window.__FIREBASE_READY__ = false;
    return;
  }

  // Carga el SDK v10 de Firebase desde la CDN (módulos ESM)
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
    import {
      getFirestore,
      doc,
      setDoc,
      deleteDoc,
      collection,
      onSnapshot,
      serverTimestamp
    } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

    const app = initializeApp(${JSON.stringify(config)});
    const db  = getFirestore(app);

    // --- API expuesta al resto de la app ---
    const api = {
      db,
      doc, setDoc, deleteDoc, collection, onSnapshot, serverTimestamp,
      // Guarda/actualiza un partido (id estable = match.id)
      async saveMatch(tournamentId, match) {
        const ref = doc(db, 'tournaments', tournamentId, 'matches', match.id);
        await setDoc(ref, {
          ...match,
          updatedAt: serverTimestamp()
        });
      },
      async deleteMatch(tournamentId, matchId) {
        const ref = doc(db, 'tournaments', tournamentId, 'matches', matchId);
        await deleteDoc(ref);
      },
      // Suscripción en tiempo real a todos los partidos del torneo
      subscribeMatches(tournamentId, onChange, onError) {
        const colRef = collection(db, 'tournaments', tournamentId, 'matches');
        return onSnapshot(colRef, (snap) => {
          const map = {};
          snap.forEach((d) => (map[d.id] = d.data()));
          onChange(map);
        }, onError);
      },
      async saveTournamentMeta(tournamentId, meta) {
        const ref = doc(db, 'tournaments', tournamentId);
        await setDoc(ref, { ...meta, updatedAt: serverTimestamp() }, { merge: true });
      }
    };

    window.FirebaseAPI = api;
    window.__FIREBASE_READY__ = true;
    window.dispatchEvent(new Event('firebase-ready'));
  `;
  document.head.appendChild(script);
})();
