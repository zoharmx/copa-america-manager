#!/usr/bin/env node
// scripts/build-firebase-config.js
// Genera public/js/firebase-runtime-config.js a partir de variables
// de entorno de Vercel (FIREBASE_*). En Vercel, se ejecuta antes del
// deploy gracias a "buildCommand" en vercel.json.
//
// En local:    node scripts/build-firebase-config.js
// En Vercel:   se ejecuta automáticamente durante el build

const fs = require('fs');
const path = require('path');

const out = path.join(__dirname, '..', 'public', 'js', 'firebase-runtime-config.js');

// .trim() por si el valor llega con saltos de línea/espacios (p. ej. al
// pegar la config en el dashboard de Vercel), que romperían la inicialización.
const apiKey            = (process.env.FIREBASE_API_KEY            || '').trim();
const authDomain        = (process.env.FIREBASE_AUTH_DOMAIN        || '').trim();
const projectId         = (process.env.FIREBASE_PROJECT_ID         || '').trim();
const storageBucket     = (process.env.FIREBASE_STORAGE_BUCKET     || '').trim();
const messagingSenderId = (process.env.FIREBASE_MESSAGING_SENDER_ID || '').trim();
const appId             = (process.env.FIREBASE_APP_ID             || '').trim();

if (!apiKey) {
  console.log('[build] FIREBASE_API_KEY no definida — se omite (la app funcionará offline).');
}

const content = `// GENERADO AUTOMÁTICAMENTE por scripts/build-firebase-config.js
// NO EDITAR A MANO. Si necesitas cambiarlo, edita las variables de
// entorno FIREBASE_* en Vercel o en tu .env local.

window.__FIREBASE_CONFIG__ = {
  apiKey:            ${JSON.stringify(apiKey)},
  authDomain:        ${JSON.stringify(authDomain)},
  projectId:         ${JSON.stringify(projectId)},
  storageBucket:     ${JSON.stringify(storageBucket)},
  messagingSenderId: ${JSON.stringify(messagingSenderId)},
  appId:             ${JSON.stringify(appId)}
};

if (window.__FIREBASE_CONFIG__.apiKey === '') {
  delete window.__FIREBASE_CONFIG__;
}
`;

fs.writeFileSync(out, content, 'utf8');
console.log(`[build] ${out} generado con ${apiKey ? 'config real' : 'placeholders vacíos'}.`);
