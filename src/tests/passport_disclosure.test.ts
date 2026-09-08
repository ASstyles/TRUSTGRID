import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { DatabaseService } from '../database/db.service.js';
import { TrustPassportService } from '../core/passport/passport.service.js';
import { CryptoService } from '../core/crypto/crypto.service.js';

describe('Trust Passport & Cryptographic Selective Disclosure Suite', () => {
  let db: DatabaseService;
  let passportService: TrustPassportService;
  const testStudentDid = 'did:trustgrid:student:rohan-test';
  const testUnivDid = 'did:trustgrid:org:iit-delhi';

  before(() => {
    db = DatabaseService.getTestInstance();
    passportService = new TrustPassportService(db);

    // Seed test identity
    db.run(
      `INSERT OR REPLACE INTO identities 
       (did, entity_type, controller_did, public_key, key_type, verification_method, authentication_methods, service_endpoints, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testStudentDid,
        'INDIVIDUAL',
        testStudentDid,
        'pubkey-rohan',
        'Ed25519VerificationKey2020',
        `${testStudentDid}#key-1`,
        JSON.stringify([`${testStudentDid}#key-1`]),
        JSON.stringify({}),
        new Date().toISOString(),
      ]
    );

    // Seed test trust object
    const metadata = {
      studentName: 'Rohan Sharma',
      studentRollNo: 'CS-2022-8891',
      degreeName: 'Bachelor of Technology',
      major: 'Computer Science and Engineering',
      graduationYear: 2026,
      cgpa: '8.85',
      address: 'Hostel 4, IIT Delhi Campus',
      internalId: 'SECRET-INT-9901',
    };

    db.run(
      `INSERT OR REPLACE INTO trust_objects 
       (trust_object_id, object_type, subject_id, issuer_id, owner_id, created_at, content_hash, signature, blockchain_tx_id, status, version, metadata, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'TO-EDU-ROHAN-001',
        'CREDENTIAL',
        testStudentDid,
        testUnivDid,
        testStudentDid,
        new Date().toISOString(),
        'hash-rohan-degree',
        'sig-rohan-degree',
        'tx-rohan-001',
        'ACTIVE',
        1,
        JSON.stringify(metadata),
        Date.now(),
      ]
    );
  });

  it('1. Full disclosure passport returns all plain metadata attributes', () => {
    const passport = passportService.generatePassport(testStudentDid, false);
    assert.ok(passport);
    assert.strictEqual(passport.privacyMode, 'FULL_DISCLOSURE');
    assert.strictEqual(passport.claims.length, 1);

    const claim = passport.claims[0];
    assert.strictEqual(claim.disclosedAttributes.studentName, 'Rohan Sharma');
    assert.strictEqual(claim.disclosedAttributes.cgpa, '8.85');
    assert.strictEqual(claim.disclosedAttributes.studentRollNo, 'CS-2022-8891');
    assert.strictEqual(claim.disclosedAttributes.address, 'Hostel 4, IIT Delhi Campus');
  });

  it('2. Selective disclosure passport masks sensitive fields and sets degreeVerified flag', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    assert.strictEqual(passport.privacyMode, 'SELECTIVE_DISCLOSURE');

    const claim = passport.claims[0];
    assert.strictEqual(claim.disclosedAttributes.degreeName, 'Bachelor of Technology');
    assert.strictEqual(claim.disclosedAttributes.graduationYear, 2026);
    assert.strictEqual(claim.disclosedAttributes.degreeVerified, true);

    // Sensitive attributes are excluded from disclosedAttributes
    assert.strictEqual(claim.disclosedAttributes.cgpa, undefined);
    assert.strictEqual(claim.disclosedAttributes.studentRollNo, undefined);
    assert.strictEqual(claim.disclosedAttributes.address, undefined);
    assert.ok(claim.hiddenAttributesCount > 0);
  });

  it('3. Selective disclosure generates cryptographic salted commitments for attributes', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];

    assert.ok(claim.attributeCommitments);
    assert.ok(claim.attributeCommitments.length > 0);

    const degreeNameCommit = claim.attributeCommitments.find((c) => c.attribute === 'degreeName');
    assert.ok(degreeNameCommit);
    assert.strictEqual(degreeNameCommit.isDisclosed, true);
    assert.ok(degreeNameCommit.salt);
    assert.ok(degreeNameCommit.commitment);

    const addressCommit = claim.attributeCommitments.find((c) => c.attribute === 'address');
    assert.ok(addressCommit);
    assert.strictEqual(addressCommit.isDisclosed, false);
    assert.strictEqual(addressCommit.salt, undefined); // Salt withheld
    assert.strictEqual(addressCommit.value, undefined); // Value withheld
    assert.ok(addressCommit.commitment); // Commitment published
  });

  it('4. Disclosed attribute verifies mathematically against commitment and salt', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];
    const commit = claim.attributeCommitments?.find((c) => c.attribute === 'degreeName');
    assert.ok(commit);

    const valid = passportService.verifyDisclosedAttribute(
      'degreeName',
      commit.value,
      commit.salt || '',
      commit.commitment
    );
    assert.strictEqual(valid, true);
  });

  it('5. Tampered attribute value fails cryptographic commitment check', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];
    const commit = claim.attributeCommitments?.find((c) => c.attribute === 'degreeName');
    assert.ok(commit);

    // Attacker modifies degree name to Master of Science
    const valid = passportService.verifyDisclosedAttribute(
      'degreeName',
      'Master of Science',
      commit.salt || '',
      commit.commitment
    );
    assert.strictEqual(valid, false);
  });

  it('6. Forged salt fails cryptographic commitment check', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];
    const commit = claim.attributeCommitments?.find((c) => c.attribute === 'degreeName');
    assert.ok(commit);

    const valid = passportService.verifyDisclosedAttribute(
      'degreeName',
      commit.value,
      'fake-salt-00000',
      commit.commitment
    );
    assert.strictEqual(valid, false);
  });

  it('7. Numeric credential generates Predicate Proof (e.g. CGPA >= 7.5)', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];

    assert.ok(claim.predicateProofs);
    assert.ok(claim.predicateProofs.length > 0);

    const cgpaProof = claim.predicateProofs.find((p) => p.attribute === 'cgpa');
    assert.ok(cgpaProof);
    assert.strictEqual(cgpaProof.satisfied, true);
    assert.strictEqual(cgpaProof.predicate, '>= 7.5');
    assert.strictEqual(cgpaProof.proofMethod, 'SALTED_ATTRIBUTE_COMMITMENT');
  });

  it('8. verifyPredicateProof validates predicate statement without revealing raw GPA score', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];
    const proof = claim.predicateProofs?.find((p) => p.attribute === 'cgpa');
    assert.ok(proof);

    // Subject reveals salt only for the predicate verifier
    const salt = CryptoService.sha256(`salt:${testStudentDid}:TO-EDU-ROHAN-001:cgpa`);
    const verified = passportService.verifyPredicateProof(proof, 8.85, salt);
    assert.strictEqual(verified, true);
  });

  it('9. verifyPredicateProof rejects if tested value fails predicate threshold', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    const claim = passport.claims[0];
    const proof = claim.predicateProofs?.find((p) => p.attribute === 'cgpa');
    assert.ok(proof);

    const salt = CryptoService.sha256(`salt:${testStudentDid}:TO-EDU-ROHAN-001:cgpa`);
    // Testing value below threshold
    const verified = passportService.verifyPredicateProof(proof, 6.2, salt);
    assert.strictEqual(verified, false);
  });

  it('10. Reputation trust score starts high for clean active credentials', () => {
    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    assert.ok(passport.reputationTrustScore >= 80);
    assert.strictEqual(passport.summary.isFullyVerified, true);
    assert.strictEqual(passport.summary.activeCredentials, 1);
    assert.strictEqual(passport.summary.revokedCredentials, 0);
  });

  it('11. Reputation trust score penalizes revoked credentials', () => {
    // Add revoked credential
    db.run(
      `INSERT OR REPLACE INTO trust_objects 
       (trust_object_id, object_type, subject_id, issuer_id, owner_id, created_at, content_hash, signature, blockchain_tx_id, status, version, metadata, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'TO-EDU-ROHAN-REVOKED',
        'CREDENTIAL',
        testStudentDid,
        testUnivDid,
        testStudentDid,
        new Date().toISOString(),
        'hash-revoked',
        'sig-revoked',
        'tx-revoked',
        'REVOKED',
        1,
        JSON.stringify({ degreeName: 'Fraudulent Diploma' }),
        Date.now(),
      ]
    );

    const passport = passportService.generatePassport(testStudentDid, true);
    assert.ok(passport);
    assert.strictEqual(passport.summary.revokedCredentials, 1);
    assert.ok(passport.reputationTrustScore < 80);
  });

  it('12. Non-existent DID returns null safely', () => {
    const passport = passportService.generatePassport('did:trustgrid:nonexistent:user');
    assert.strictEqual(passport, null);
  });
});
