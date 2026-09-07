import test from 'node:test';
import assert from 'node:assert/strict';
import { CryptoService } from '../core/crypto/crypto.service.js';

test('Cryptographic Primitives Suite', async (t) => {
  await t.test('Ed25519 KeyPair generation and signature verification', () => {
    const keyPair = CryptoService.generateEd25519KeyPair();
    assert.ok(keyPair.publicKey.includes('BEGIN PUBLIC KEY'));
    assert.ok(keyPair.privateKey.includes('BEGIN PRIVATE KEY'));

    const message = 'TRUSTGRID-TRANSACTION-PAYLOAD-2026';
    const signature = CryptoService.sign(message, keyPair.privateKey);
    assert.ok(signature.length > 32);

    const isValid = CryptoService.verify(message, signature, keyPair.publicKey);
    assert.equal(isValid, true);

    const isCorruptedValid = CryptoService.verify('CORRUPTED-PAYLOAD', signature, keyPair.publicKey);
    assert.equal(isCorruptedValid, false);
  });

  await t.test('Deterministic Canonical JSON Stringify produces identical hashes irrespective of key order', () => {
    const objA = {
      zebra: 100,
      apple: 'fruit',
      nested: { beta: 2, alpha: 1 },
      list: [1, 2, 3],
    };

    const objB = {
      nested: { alpha: 1, beta: 2 },
      list: [1, 2, 3],
      apple: 'fruit',
      zebra: 100,
    };

    const hashA = CryptoService.hashObject(objA);
    const hashB = CryptoService.hashObject(objB);

    assert.equal(hashA, hashB);
    assert.equal(hashA.length, 64);
  });

  await t.test('AES-256-GCM Private Key Keystore encryption and decryption', () => {
    const secret = 'super-secure-hashing-secret-passphrase';
    const plainPrivateKey = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----';

    const keystore = CryptoService.encryptPrivateKey(plainPrivateKey, secret);
    assert.equal(keystore.algorithm, 'aes-256-gcm');
    assert.notEqual(keystore.ciphertext, plainPrivateKey);

    const decrypted = CryptoService.decryptPrivateKey(keystore, secret);
    assert.equal(decrypted, plainPrivateKey);
  });

  await t.test('Merkle Tree Root computes deterministic root hash', () => {
    const leaves = [
      CryptoService.sha256('tx-1'),
      CryptoService.sha256('tx-2'),
      CryptoService.sha256('tx-3'),
      CryptoService.sha256('tx-4'),
    ];

    const root = CryptoService.computeMerkleRoot(leaves);
    assert.equal(root.length, 64);

    // Changing one leaf must alter the Merkle root
    const alteredLeaves = [leaves[0], leaves[1], CryptoService.sha256('tx-3-tampered'), leaves[3]];
    const alteredRoot = CryptoService.computeMerkleRoot(alteredLeaves);
    assert.notEqual(root, alteredRoot);
  });
});
