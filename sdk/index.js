"use strict";
/**
 * Private State Toolkit (PST) - TypeScript SDK
 *
 * Client-side utilities for interacting with the PST Solana program.
 * Handles encryption, commitment computation, and transaction building.
 *
 * @module pst-sdk
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePolicy = void 0;
exports.getProgramId = getProgramId;
exports.commitment = commitment;
exports.encryptPayload = encryptPayload;
exports.decryptPayload = decryptPayload;
exports.packEncryptedPayload = packEncryptedPayload;
exports.unpackEncryptedPayload = unpackEncryptedPayload;
exports.initPrivateState = initPrivateState;
exports.updatePrivateState = updatePrivateState;
exports.setPolicy = setPolicy;
exports.assertState = assertState;
exports.decodePrivateState = decodePrivateState;
exports.readOnchainState = readOnchainState;
exports.watchState = watchState;
var crypto_1 = require("crypto");
var web3_js_1 = require("@solana/web3.js");
/**
 * Anchor instruction discriminators (first 8 bytes of instruction data).
 * These identify which instruction to call on the program.
 */
var DISCRIMINATOR = {
    initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
    update: Buffer.from([219, 200, 88, 176, 158, 63, 253, 127]),
    transferAuthority: Buffer.from([35, 150, 249, 253, 241, 46, 101, 64]),
    assertState: Buffer.from([38, 168, 44, 85, 125, 248, 167, 163]),
    setPolicy: Buffer.from([49, 72, 252, 13, 103, 119, 4, 236]),
};
/**
 * Gets the PST program ID from environment variable.
 *
 * @returns PST program public key
 * @throws Error if PST_PROGRAM_ID is not set
 *
 * @example
 * ```typescript
 * process.env.PST_PROGRAM_ID = "4FeUYtneSbfieLwjUT1ceHtv8nDXFk2autCZFyDhpkeD";
 * const programId = getProgramId();
 * ```
 */
function getProgramId() {
    var value = process.env.PST_PROGRAM_ID;
    if (!value) {
        throw new Error("PST_PROGRAM_ID env var is required.");
    }
    return new web3_js_1.PublicKey(value);
}
/**
 * Computes a cryptographic commitment for PST.
 *
 * **Formula:** `sha256(nonce || encrypted_payload)`
 *
 * This is the core security primitive. The commitment proves you have
 * specific encrypted data at a specific nonce without revealing the data.
 *
 * @param nonce - Monotonically increasing nonce (prevents replay)
 * @param encryptedPayload - Packed encrypted payload (iv + tag + ciphertext)
 * @returns 32-byte SHA-256 commitment hash
 *
 * @example
 * ```typescript
 * const nonce = 5n;
 * const { packed } = encryptPayload(key, plaintext);
 * const commit = commitment(nonce, packed);
 * // commit is a 32-byte Buffer
 * ```
 */
function commitment(nonce, encryptedPayload) {
    var nonceBuf = Buffer.alloc(8);
    nonceBuf.writeBigUInt64LE(nonce);
    return (0, crypto_1.createHash)("sha256")
        .update(Buffer.concat([nonceBuf, encryptedPayload]))
        .digest();
}
/**
 * Update policy for nonce validation.
 *
 * Determines how strictly nonces must increment.
 */
var UpdatePolicy;
(function (UpdatePolicy) {
    /** Nonce must increment by exactly 1 (turn-based, deterministic) */
    UpdatePolicy[UpdatePolicy["StrictSequential"] = 0] = "StrictSequential";
    /** Nonce must increase but can skip values (async, offline-friendly) */
    UpdatePolicy[UpdatePolicy["AllowSkips"] = 1] = "AllowSkips";
})(UpdatePolicy || (exports.UpdatePolicy = UpdatePolicy = {}));
/**
 * Encrypts plaintext using AES-256-GCM.
 *
 * Uses authenticated encryption to ensure confidentiality and integrity.
 * A random IV is generated for each encryption (never reuse IVs with same key!).
 *
 * @param key - 32-byte AES-256 key
 * @param plaintext - Data to encrypt
 * @returns Object with payload components and packed buffer
 *
 * @example
 * ```typescript
 * const key = randomBytes(32);
 * const plaintext = Buffer.from(JSON.stringify({ counter: 0 }));
 * const { payload, packed } = encryptPayload(key, plaintext);
 * // payload: { iv, tag, ciphertext }
 * // packed: concatenated buffer for commitment computation
 * ```
 */
function encryptPayload(key, plaintext) {
    var iv = (0, crypto_1.randomBytes)(12); // Random IV for each encryption
    var cipher = (0, crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    var ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    var tag = cipher.getAuthTag(); // GCM authentication tag
    var packed = packEncryptedPayload({ iv: iv, tag: tag, ciphertext: ciphertext });
    return { payload: { iv: iv, tag: tag, ciphertext: ciphertext }, packed: packed };
}
/**
 * Decrypts a packed encrypted payload using AES-256-GCM.
 *
 * Verifies the authentication tag before decryption. Will throw if
 * the ciphertext was tampered with.
 *
 * @param key - 32-byte AES-256 key (must match encryption key)
 * @param packed - Packed payload (iv + tag + ciphertext)
 * @returns Decrypted plaintext
 * @throws Error if authentication fails (tampered data)
 *
 * @example
 * ```typescript
 * const plaintext = decryptPayload(key, packed);
 * const state = JSON.parse(plaintext.toString());
 * ```
 */
function decryptPayload(key, packed) {
    var _a = unpackEncryptedPayload(packed), iv = _a.iv, tag = _a.tag, ciphertext = _a.ciphertext;
    var decipher = (0, crypto_1.createDecipheriv)("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
/**
 * Packs encrypted payload components into a single buffer.
 *
 * **Format:** `iv (12 bytes) || tag (16 bytes) || ciphertext (variable)`
 *
 * @param payload - Encrypted payload components
 * @returns Concatenated buffer
 */
function packEncryptedPayload(payload) {
    return Buffer.concat([payload.iv, payload.tag, payload.ciphertext]);
}
/**
 * Unpacks a packed encrypted payload into components.
 *
 * **Format:** `iv (12 bytes) || tag (16 bytes) || ciphertext (variable)`
 *
 * @param packed - Packed payload buffer
 * @returns Separated payload components
 */
function unpackEncryptedPayload(packed) {
    var iv = packed.subarray(0, 12);
    var tag = packed.subarray(12, 28);
    var ciphertext = packed.subarray(28);
    return { iv: iv, tag: tag, ciphertext: ciphertext };
}
/**
 * Initialize a new PST account (non-PDA).
 *
 * @param params.initialCommitment - sha256(nonce || encrypted_payload) at nonce 0
 * @param params.policy - Update policy enforced on-chain
 * @returns Transaction signature
 */
function initPrivateState(params) {
    return __awaiter(this, void 0, void 0, function () {
        var ix, tx;
        return __generator(this, function (_a) {
            ix = new web3_js_1.TransactionInstruction({
                programId: getProgramId(),
                keys: [
                    {
                        pubkey: params.privateState.publicKey,
                        isSigner: true,
                        isWritable: true,
                    },
                    { pubkey: params.authority.publicKey, isSigner: true, isWritable: true },
                    { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                data: Buffer.concat([
                    DISCRIMINATOR.initialize,
                    params.initialCommitment,
                    Buffer.from([params.policy]),
                ]),
            });
            tx = new web3_js_1.Transaction().add(ix);
            return [2 /*return*/, (0, web3_js_1.sendAndConfirmTransaction)(params.connection, tx, [
                    params.authority,
                    params.privateState,
                ])];
        });
    });
}
/**
 * Update commitment + nonce with policy enforcement on-chain.
 *
 * @param params.oldCommitment - Must match stored commitment
 * @param params.newCommitment - New commitment hash
 * @param params.nextNonce - Candidate nonce (checked against policy)
 * @returns Transaction signature
 */
function updatePrivateState(params) {
    return __awaiter(this, void 0, void 0, function () {
        var nonceBuf, ix, tx;
        return __generator(this, function (_a) {
            nonceBuf = Buffer.alloc(8);
            nonceBuf.writeBigUInt64LE(params.nextNonce);
            ix = new web3_js_1.TransactionInstruction({
                programId: getProgramId(),
                keys: [
                    { pubkey: params.privateState, isSigner: false, isWritable: true },
                    { pubkey: params.authority.publicKey, isSigner: true, isWritable: false },
                ],
                data: Buffer.concat([
                    DISCRIMINATOR.update,
                    params.oldCommitment,
                    params.newCommitment,
                    nonceBuf,
                ]),
            });
            tx = new web3_js_1.Transaction().add(ix);
            return [2 /*return*/, (0, web3_js_1.sendAndConfirmTransaction)(params.connection, tx, [params.authority])];
        });
    });
}
/**
 * Update the policy byte (authority signer required).
 *
 * @returns Transaction signature
 */
function setPolicy(params) {
    return __awaiter(this, void 0, void 0, function () {
        var ix, tx;
        return __generator(this, function (_a) {
            ix = new web3_js_1.TransactionInstruction({
                programId: getProgramId(),
                keys: [
                    { pubkey: params.privateState, isSigner: false, isWritable: true },
                    { pubkey: params.authority.publicKey, isSigner: true, isWritable: false },
                ],
                data: Buffer.concat([
                    DISCRIMINATOR.setPolicy,
                    Buffer.from([params.policy]),
                ]),
            });
            tx = new web3_js_1.Transaction().add(ix);
            return [2 /*return*/, (0, web3_js_1.sendAndConfirmTransaction)(params.connection, tx, [params.authority])];
        });
    });
}
/**
 * CPI-friendly validator. Asserts commitment + nonce without mutation.
 * The payer signs to cover fees.
 *
 * @returns Transaction signature
 */
function assertState(params) {
    return __awaiter(this, void 0, void 0, function () {
        var nonceBuf, ix, tx;
        return __generator(this, function (_a) {
            nonceBuf = Buffer.alloc(8);
            nonceBuf.writeBigUInt64LE(params.expectedNonce);
            ix = new web3_js_1.TransactionInstruction({
                programId: getProgramId(),
                keys: [{ pubkey: params.privateState, isSigner: false, isWritable: false }],
                data: Buffer.concat([
                    DISCRIMINATOR.assertState,
                    params.expectedCommitment,
                    nonceBuf,
                ]),
            });
            tx = new web3_js_1.Transaction().add(ix);
            return [2 /*return*/, (0, web3_js_1.sendAndConfirmTransaction)(params.connection, tx, [params.payer])];
        });
    });
}
/**
 * Manual account decoding (skip discriminator).
 *
 * Layout:
 * - authority: 32 bytes
 * - commitment: 32 bytes
 * - nonce: u64 LE
 * - policy: u8
 */
function decodePrivateState(data) {
    var offset = 8;
    var authority = new web3_js_1.PublicKey(data.subarray(offset, offset + 32));
    var commitmentBuf = data.subarray(offset + 32, offset + 64);
    var nonce = data.readBigUInt64LE(offset + 64);
    var policy = data.readUInt8(offset + 72);
    return { authority: authority, commitment: Buffer.from(commitmentBuf), nonce: nonce, policy: policy };
}
/**
 * Fetch and decode on-chain PrivateState.
 *
 * @returns Decoded account or null if missing
 */
function readOnchainState(connection, privateState) {
    return __awaiter(this, void 0, void 0, function () {
        var info;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, connection.getAccountInfo(privateState, "confirmed")];
                case 1:
                    info = _a.sent();
                    if (!info)
                        return [2 /*return*/, null];
                    return [2 /*return*/, decodePrivateState(Buffer.from(info.data))];
            }
        });
    });
}
/**
 * WebSocket subscription for account changes.
 *
 * @returns Subscription id
 */
function watchState(connection, privateState, onChange) {
    return connection.onAccountChange(privateState, function (info) {
        var decoded = decodePrivateState(Buffer.from(info.data));
        onChange(decoded);
    }, "confirmed");
}
