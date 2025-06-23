#!/usr/bin/env node

// Script to generate VAPID keys for Web Push
// Run: node scripts/generate-vapid-keys.js

import crypto from 'crypto';

function urlBase64(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generateVAPIDKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  
  const publicKey = ecdh.getPublicKey();
  const privateKey = ecdh.getPrivateKey();
  
  return {
    publicKey: urlBase64(publicKey),
    privateKey: urlBase64(privateKey)
  };
}

const keys = generateVAPIDKeys();

console.log('VAPID Keys Generated:');
console.log('====================');
console.log('\nAdd these to your .dev.vars file:');
console.log(`VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:support@example.com"`);
console.log('\nPublic Key (for client-side use):');
console.log(keys.publicKey);
console.log('\nPrivate Key (keep secret):');
console.log(keys.privateKey);
console.log('\nIMPORTANT: Never commit the private key to version control!');