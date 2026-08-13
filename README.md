# 🏆 Copa América Manager

Simulador de Copa América con persistencia en tiempo real usando **Firebase Firestore**, desplegado en **Vercel**.

## ✨ Características

- Sorteo oficial automático (4 bombos, 4 grupos)
- Gestión completa de fase de grupos y eliminatorias (cuartos, semis, final)
- Edición de marcadores, goleadores y asistidores
- Estadísticas en vivo (goleadores, asistidores, valla menos vencida)
- 🆕 **Persistencia en tiempo real** vía Firestore: cualquier persona que abra la URL ve los mismos resultados al instante

## 🚀 Despliegue rápido

### 1. Obtén tu config de Firebase (frontend)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → proyecto `copa-america-a37d2`
2. ⚙️ Configuración del proyecto → **Tus apps** → **Web app** (`</>`)
3. Si no tienes una app web, créala. Copia el objeto `firebaseConfig`:

```js
{
  apiKey: "AIza...",
  authDomain: "copa-america-a37d2.firebaseapp.com",
  projectId: "copa-america-a37d2",
  storageBucket: "copa-america-a37d2.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
}
```

### 2. Despliega las reglas de Firestore (una sola vez)

```bash
npm i -g firebase-tools
firebase login
firebase use copa-america-a37d2
firebase deploy --only firestore:rules
```

### 3. Sube el código a GitHub

⚠️ **IMPORTANTE — Seguridad**: el archivo `copa-america-a37d2-firebase-adminsdk-*.json` contiene la **clave privada de admin** y **NO debe subirse** a GitHub. Ya está en `.gitignore`. Solo usamos en el frontend la config pública del paso 1 (que es seguro exponer).

```bash
git init
git add .
git commit -m "Copa América Manager con realtime"
# Crea el repo en github.com y luego:
git remote add origin https://github.com/TU_USUARIO/copa-america-manager.git
git branch -M main
git push -u origin main
```

### 4. Despliega en Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Conecta tu repo `copa-america-manager`
3. **Antes de hacer Deploy**, ve a **Environment Variables** y añade:

   | Name | Value |
   |------|-------|
   | `FIREBASE_API_KEY` | `AIza...` (de tu config) |
   | `FIREBASE_AUTH_DOMAIN` | `copa-america-a37d2.firebaseapp.com` |
   | `FIREBASE_PROJECT_ID` | `copa-america-a37d2` |
   | `FIREBASE_STORAGE_BUCKET` | `copa-america-a37d2.appspot.com` |
   | `FIREBASE_MESSAGING_SENDER_ID` | `1234567890` |
   | `FIREBASE_APP_ID` | `1:1234567890:web:abc123` |

4. Pulsa **Deploy**. Vercel te dará una URL tipo `https://copa-america-manager.vercel.app`.

> Las variables de entorno se inyectan en el HTML en build-time por `vercel.json` + el placeholder `__FIREBASE_CONFIG__` (ver `public/index.html`).

## 🔄 Cómo funciona el realtime

- Cada vez que guardas un resultado, se persiste en Firestore (`tournaments/{id}/matches/{matchId}`)
- Un `onSnapshot` escucha cambios y actualiza la UI en vivo
- El `tournament_id` se guarda en `localStorage`, así que un mismo navegador siempre edita el mismo torneo
- Para empezar un torneo nuevo usa el botón **🔄 Nuevo Torneo** (arriba a la derecha): borra los datos actuales de Firestore y arranca un sorteo nuevo. Alternativa por consola:
  ```js
  localStorage.removeItem('tournament_id'); location.reload();
  ```

## 🛠️ Desarrollo local

```bash
npm run dev
# Abre http://localhost:3000
```

Para usar Firebase en local, abre la consola del navegador y pega tu config (modo dev):

```js
localStorage.setItem('firebase_config', JSON.stringify({
  apiKey: "AIza...",
  authDomain: "copa-america-a37d2.firebaseapp.com",
  projectId: "copa-america-a37d2",
  storageBucket: "copa-america-a37d2.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
}));
location.reload();
```

## 📁 Estructura

```
.
├── public/
│   ├── index.html              # El simulador (sin cambios visuales)
│   └── js/
│       ├── firebase-config.js  # Inicializa Firebase SDK
│       └── simulator-bridge.js # Engancha state.matches <-> Firestore
├── firestore.rules             # Reglas de seguridad
├── vercel.json                 # Config de Vercel
├── package.json
└── .gitignore                  # Excluye credenciales
```
