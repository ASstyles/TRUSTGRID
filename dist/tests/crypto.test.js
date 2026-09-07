"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const crypto_service_js_1 = require("../core/crypto/crypto.service.js");
(0, node_test_1.default)('Cryptographic Primitives Suite', async (t) => {
    await t.test('Ed25519 KeyPair generation and signature verification', () => {
        const keyPair = crypto_service_js_1.CryptoService.generateEd25519KeyPair();
        strict_1.default.ok(keyPair.publicKey.includes('BEGIN PUBLIC KEY'));
        strict_1.default.ok(keyPair.privateKey.includes('BEGIN PRIVATE KEY'));
        const message = 'TRUSTGRID-TRANSACTION-PAYLOAD-2026';
        const signature = crypto_service_js_1.CryptoService.sign(message, keyPair.privateKey);
        strict_1.default.ok(signature.length > 32);
        const isValid = crypto_service_js_1.CryptoService.verify(message, signature, keyPair.publicKey);
        strict_1.default.equal(isValid, true);
        const isCorruptedValid = crypto_service_js_1.CryptoService.verify('CORRUPTED-PAYLOAD', signature, keyPair.publicKey);
        strict_1.default.equal(isCorruptedValid, false);
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
        const hashA = crypto_service_js_1.CryptoService.hashObject(objA);
        const hashB = crypto_service_js_1.CryptoService.hashObject(objB);
        strict_1.default.equal(hashA, hashB);
        strict_1.default.equal(hashA.length, 64);
    });
    await t.test('AES-256-GCM Private Key Keystore encryption and decryption', () => {
        const secret = 'super-secure-hashing-secret-passphrase';
        const plainPrivateKey = '-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----';
        const keystore = crypto_service_js_1.CryptoService.encryptPrivateKey(plainPrivateKey, secret);
        strict_1.default.equal(keystore.algorithm, 'aes-256-gcm');
        strict_1.default.notEqual(keystore.ciphertext, plainPrivateKey);
        const decrypted = crypto_service_js_1.CryptoService.decryptPrivateKey(keystore, secret);
        strict_1.default.equal(decrypted, plainPrivateKey);
    });
    await t.test('Merkle Tree Root computes deterministic root hash', () => {
        const leaves = [
            crypto_service_js_1.CryptoService.sha256('tx-1'),
            crypto_service_js_1.CryptoService.sha256('tx-2'),
            crypto_service_js_1.CryptoService.sha256('tx-3'),
            crypto_service_js_1.CryptoService.sha256('tx-4'),
        ];
        const root = crypto_service_js_1.CryptoService.computeMerkleRoot(leaves);
        strict_1.default.equal(root.length, 64);
        // Changing one leaf must alter the Merkle root
        const alteredLeaves = [leaves[0], leaves[1], crypto_service_js_1.CryptoService.sha256('tx-3-tampered'), leaves[3]];
        const alteredRoot = crypto_service_js_1.CryptoService.computeMerkleRoot(alteredLeaves);
        strict_1.default.notEqual(root, alteredRoot);
    });
});
