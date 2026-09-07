"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDemoRoutes = createDemoRoutes;
const express_1 = require("express");
function createDemoRoutes(verificationService, db) {
    const router = (0, express_1.Router)();
    const scenarios = [
        {
            id: 'SCENARIO_1_FAKE_CERTIFICATE',
            sector: 'EDUCATION',
            title: '1. Detect Tampered Academic Degree',
            subtitle: 'Original Student Rahul Sharma vs Forged Rohan Sharma (Fake CGPA 9.95)',
            description: 'Demonstrates off-chain database tampering detection. A student degree forged in off-chain records is instantly caught by calculating the canonical SHA-256 hash and comparing it against the on-chain proof.',
            trustObjectId: 'TO-EDU-DEGREE-TAMPERED-2024',
            comparisonId: 'TO-EDU-DEGREE-GENUINE-2024',
            expectedStatus: 'TAMPERED',
            keyPoint: 'TOP detects bit-flip modifications even if issuer signature is genuine for the original content.',
        },
        {
            id: 'SCENARIO_2_COUNTERFEIT_PRODUCT',
            sector: 'SUPPLY_CHAIN',
            title: '2. Trace Product & Detect Counterfeit Batch',
            subtitle: 'Life-saving Remdesivir Antiviral Injection (Unbroken vs Injected Counterfeit Batch)',
            description: 'Demonstrates multi-tier custody tracking across Manufacturer, Cold-Chain Distributor, Warehouse, and Pharmacy. Flags counterfeit injection attempting to clone legitimate lot numbers without authentic transfer signatures.',
            trustObjectId: 'TO-PRD-COUNTERFEIT-BATCH-999',
            comparisonId: 'TO-PRD-REMDESIVIR-BATCH-402',
            expectedStatus: 'PROVENANCE_MISMATCH',
            keyPoint: 'TOP validates certified handoff continuity: every transfer requires the cryptographic signature of the legitimate prior custodian.',
        },
        {
            id: 'SCENARIO_3_ALTERED_LEGAL_EVIDENCE',
            sector: 'LEGAL',
            title: '3. Digital Evidence Chain of Custody & Spoliation',
            subtitle: 'Seized 4K CCTV Corridor Surveillance (Modified frames in security incident)',
            description: 'Demonstrates tamper-evident digital forensic evidence chain of custody (Investigator → Forensic Lab → High Court). Catches frame spoliation where timestamps and camera feeds were altered.',
            trustObjectId: 'TO-EVI-CCTV-TAMPERED-082',
            comparisonId: 'TO-EVI-CCTV-FORENSIC-081',
            expectedStatus: 'TAMPERED',
            keyPoint: 'Forensic integrity is guaranteed without storing massive video files on-chain; only cryptographic proofs and signed custody transitions are anchored.',
        },
        {
            id: 'SCENARIO_4_DEVICE_COMPROMISE',
            sector: 'CYBERSECURITY',
            title: '4. Critical Infrastructure Configuration Drift Alert',
            subtitle: 'Power Grid SCADA Edge Gateway (Unauthorized firewall backdoor injected)',
            description: 'Demonstrates zero-trust device configuration baselines. An unauthorized modification to critical infrastructure firmware/firewall rules instantly generates a CRITICAL security event on the blockchain ledger.',
            trustObjectId: 'TO-DEV-EDGE-GATEWAY-01',
            comparisonId: 'TO-DEV-CORE-ROUTER-09',
            expectedStatus: 'DEVICE_INTEGRITY_COMPROMISED',
            keyPoint: 'TOP bridges physical/IT assets to decentralized trust: baselines are tamper-evident, and security alerts are anchored on-chain.',
        },
    ];
    // GET all flagship demo scenarios
    router.get('/scenarios', (_req, res) => {
        res.json({
            success: true,
            protocol: 'TRUSTGRID Trust Object Protocol (TOP) v1.0',
            network: 'Consortium Notary Ledger (Local MVP) / Hyperledger Fabric Ready',
            message: 'All four sectors are verified by the EXACT same Trust Object Protocol and verification engine.',
            scenarios,
        });
    });
    // Run a specific flagship scenario
    router.post('/run/:scenarioId', async (req, res) => {
        try {
            const scenario = scenarios.find((s) => s.id === req.params.scenarioId);
            if (!scenario) {
                return res.status(404).json({ success: false, error: 'Scenario not found' });
            }
            // Verify the target scenario object
            const targetResult = await verificationService.verifyTrustObject({
                trustObjectId: scenario.trustObjectId,
            });
            // Verify comparison authentic object
            const comparisonResult = await verificationService.verifyTrustObject({
                trustObjectId: scenario.comparisonId,
            });
            res.json({
                success: true,
                scenario,
                targetResult,
                comparisonResult,
                verdict: {
                    detected: targetResult.overallStatus === scenario.expectedStatus,
                    expectedStatus: scenario.expectedStatus,
                    observedStatus: targetResult.overallStatus,
                    explanation: `Trust Object Protocol successfully verified target as ${targetResult.overallStatus} and comparison as ${comparisonResult.overallStatus}.`,
                },
            });
        }
        catch (err) {
            res.status(500).json({ success: false, error: err.message });
        }
    });
    return router;
}
