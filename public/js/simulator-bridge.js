// simulator-bridge.js
// Conecta el simulador (que vive en el mismo <script> del HTML) con Firestore.
// Estrategia:
//   - Estado local (state) = fuente de verdad inmediata para la UI
//   - Cada vez que el usuario GUARDA un resultado, persistimos en Firestore
//   - onSnapshot hidrata state.matches desde la nube y re-renderiza en vivo
//
// Si Firebase no está configurado, la app sigue funcionando 100% local.

(function () {
  const TOURNAMENT_ID =
    localStorage.getItem('tournament_id') ||
    (() => {
      const id = 'torneo_' + Date.now();
      localStorage.setItem('tournament_id', id);
      return id;
    })();

  let unsub = null;
  let initialHydrated = false;

  // Espera a que el HTML haya definido `state` y a que Firebase esté listo
  function tryAttach() {
    if (typeof state === 'undefined') return false;
    if (!window.__FIREBASE_READY__) return false;
    if (window.__BRIDGE_ATTACHED__) return true;
    window.__BRIDGE_ATTACHED__ = true;
    attach();
    return true;
  }

  // Reintenta cada 100ms hasta que ambos estén disponibles
  const waiter = setInterval(() => {
    if (tryAttach()) clearInterval(waiter);
  }, 100);

  function attach() {
    // Bloquea el botón de sorteo hasta que el snapshot confirme si ya hay un
    // torneo guardado en la nube. Sin esto, un clic rápido justo tras un
    // refresh (cuando state.matches aún está vacío) regenera un sorteo
    // aleatorio y pisa los datos restaurados. (El botón ya viene deshabilitado
    // desde index.html; aquí se reafirma y se re-habilita según el snapshot.)
    const btnDraw = document.getElementById('btn-draw');
    const enableDraw = () => { if (btnDraw) btnDraw.disabled = false; };
    if (btnDraw) btnDraw.disabled = true;

    // Muestra el id del torneo en pantalla para depurar
    const badge = document.createElement('div');
    badge.style.cssText =
      'position:fixed;bottom:8px;left:8px;z-index:9999;font-size:11px;' +
      'background:rgba(0,0,0,.6);color:#94a3b8;padding:4px 8px;border-radius:6px;' +
      'font-family:monospace;';
    badge.textContent = '🔗 Torneo: ' + TOURNAMENT_ID;
    document.body.appendChild(badge);

    // Guarda meta inicial (sorteo)
    const { saveTournamentMeta } = window.FirebaseAPI;
    saveTournamentMeta(TOURNAMENT_ID, {
      createdAt: new Date().toISOString(),
      name: 'Copa América Manager'
    }).catch((e) => console.warn('[Firebase] meta save error', e));

    // Suscripción en tiempo real
    unsub = window.FirebaseAPI.subscribeMatches(
      TOURNAMENT_ID,
      (remoteMatches) => {
        if (!initialHydrated && Object.keys(remoteMatches).length === 0) {
          // Primer arranque, nada en la nube aún: se puede hacer el sorteo
          initialHydrated = true;
          enableDraw();
          return;
        }
        initialHydrated = true;
        // Mezcla partidos remotos en el estado local
        window.__SYNCED_IDS__ = window.__SYNCED_IDS__ || new Set();
        Object.values(remoteMatches).forEach((rm) => {
          // Lo que llega de la nube ya esta sincronizado: evita reenviarlo
          window.__SYNCED_IDS__.add(rm.id);
          const idx = state.matches.findIndex((m) => m.id === rm.id);
          if (idx >= 0) {
            state.matches[idx] = rm;
          } else {
            state.matches.push(rm);
          }
        });

        // --- Restauración de la app cuando llegan datos de la nube ---
        // (p. ej. tras un refresh: los resultados siguen en Firestore pero la
        //  app muestra la pantalla de sorteo y state.groups está vacío).
        const hasMatches = state.matches.length > 0;
        if (hasMatches) {
          const groupsEmpty = Object.values(state.groups).every((g) => g.length === 0);
          if (groupsEmpty) {
            // Reconstruye las tablas de grupos desde los partidos hidratados.
            // Los grupos se derivan de los propios partidos, asi que funciona
            // con cualquier numero de grupos (hoy 6: A-F).
            const teamsByGroup = {};
            state.matches
              .filter((m) => m.type === 'group')
              .forEach((m) => {
                if (!teamsByGroup[m.group]) teamsByGroup[m.group] = [];
                [m.t1, m.t2].forEach((t) => {
                  if (t && !teamsByGroup[m.group].some((x) => x.id === t.id)) {
                    teamsByGroup[m.group].push(t);
                  }
                });
              });
            Object.keys(teamsByGroup).forEach((g) => {
              state.groups[g] = teamsByGroup[g];
            });
            // Recalcula posiciones desde los resultados jugados (solo si
            // acabamos de reconstruir las tablas, para no tocar un sorteo local)
            if (typeof recalculateGroupStandings === 'function') recalculateGroupStandings();
          }

          // Muestra el dashboard en lugar de la pantalla de sorteo
          const initSection = document.getElementById('init-section');
          const dashboard = document.getElementById('main-dashboard');
          if (initSection) initSection.classList.add('hidden');
          if (dashboard) dashboard.classList.remove('hidden');

          // Si hay cruces de eliminación, muestra el bracket
          const hasKnockouts = state.matches.some((m) => m.type !== 'group');
          if (hasKnockouts) {
            // Marca los octavos como ya generados para no volver a sortearlos
            // al editar un partido de grupos tras un refresh.
            state.knockoutsGenerated = true;
            const kWarning = document.getElementById('knockout-warning');
            const kBracket = document.getElementById('knockout-bracket');
            if (kWarning) kWarning.classList.add('hidden');
            if (kBracket) kBracket.classList.remove('hidden');
          }
          // Ya sabemos que hay torneo guardado; el sorteo queda oculto igualmente
          enableDraw();
        }
        // Re-render si las funciones existen
        if (typeof renderAll === 'function') renderAll();
        else if (typeof renderGroups === 'function') renderGroups();
        if (typeof updateStats === 'function') updateStats();
        if (typeof renderKnockouts === 'function') renderKnockouts();
      },
      (err) => {
        console.error('[Firebase] snapshot error', err);
        // Si la suscripción falla, no dejar el sorteo bloqueado para siempre
        enableDraw();
      }
    );

    // Engancha la persistencia: cada vez que el simulador modifique un
    // partido, lo enviamos a Firestore. Hacemos esto envolviendo saveModal.
    const originalSave = window.saveModal;
    window.saveModal = async function () {
      const result = originalSave && originalSave.apply(this, arguments);
      // Después de que el simulador haya actualizado state.matches,
      // persistimos los partidos que estén "played" o los nuevos.
      try {
        // Tomamos todos los matches que ya estaban en state
        const played = state.matches.filter((m) => m.played);
        // Y todos los no jugados nuevos que aún no estén en la nube
        const all = state.matches;
        const { saveMatch } = window.FirebaseAPI;
        await Promise.all(
          all.map((m) => saveMatch(TOURNAMENT_ID, m).catch((e) =>
            console.warn('[Firebase] saveMatch error', m.id, e)
          ))
        );
        console.log('[Firebase] guardado', all.length, 'partidos');
      } catch (e) {
        console.error('[Firebase] persist error', e);
      }
      return result;
    };
  }

  // Limpia la suscripción si la página se cierra
  window.addEventListener('beforeunload', () => {
    if (unsub) unsub();
  });
})();
