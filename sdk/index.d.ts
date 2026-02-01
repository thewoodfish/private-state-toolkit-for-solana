/**
 * Private State Toolkit (PST) - TypeScript SDK
 *
 * Client-side utilities for interacting with the PST Solana program.
 * Handles encryption, commitment computation, and transaction building.
 *
 * @module pst-sdk
 */
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
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
export declare function getProgramId(): PublicKey;
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
export declare function commitment(nonce: bigint, encryptedPayload: Buffer): Buffer;
/**
 * Encrypted payload components from AES-256-GCM encryption.
 */
export type EncryptedPayload = {
    /** Initialization vector (12 bytes) */
    iv: Buffer;
    /** Authentication tag (16 bytes) */
    tag: Buffer;
    /** Encrypted ciphertext (variable length) */
    ciphertext: Buffer;
};
/**
 * Update policy for nonce validation.
 *
 * Determines how strictly nonces must increment.
 */
export declare enum UpdatePolicy {
    /** Nonce must increment by exactly 1 (turn-based, deterministic) */
    StrictSequential = 0,
    /** Nonce must increase but can skip values (async, offline-friendly) */
    AllowSkips = 1
}
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
export declare function encryptPayload(key: Buffer, plaintext: Buffer): {
    payload: EncryptedPayload;
    packed: Buffer;
};
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
export declare function decryptPayload(key: Buffer, packed: Buffer): Buffer;
/**
 * Packs encrypted payload components into a single buffer.
 *
 * **Format:** `iv (12 bytes) || tag (16 bytes) || ciphertext (variable)`
 *
 * @param payload - Encrypted payload components
 * @returns Concatenated buffer
 */
export declare function packEncryptedPayload(payload: EncryptedPayload): Buffer;
/**
 * Unpacks a packed encrypted payload into components.
 *
 * **Format:** `iv (12 bytes) || tag (16 bytes) || ciphertext (variable)`
 *
 * @param packed - Packed payload buffer
 * @returns Separated payload components
 */
export declare function unpackEncryptedPayload(packed: Buffer): EncryptedPayload;
/**
 * Initialize a new PST account (non-PDA).
 *
 * @param params.initialCommitment - sha256(nonce || encrypted_payload) at nonce 0
 * @param params.policy - Update policy enforced on-chain
 * @returns Transaction signature
 */
export declare function initPrivateState(params: {
    connection: Connection;
    authority: Keypair;
    privateState: Keypair;
    initialCommitment: Buffer;
    policy: UpdatePolicy;
}): Promise<string>;
/**
 * Update commitment + nonce with policy enforcement on-chain.
 *
 * @param params.oldCommitment - Must match stored commitment
 * @param params.newCommitment - New commitment hash
 * @param params.nextNonce - Candidate nonce (checked against policy)
 * @returns Transaction signature
 */
export declare function updatePrivateState(params: {
    connection: Connection;
    authority: Keypair;
    privateState: PublicKey;
    oldCommitment: Buffer;
    newCommitment: Buffer;
    nextNonce: bigint;
}): Promise<string>;
/**
 * Update the policy byte (authority signer required).
 *
 * @returns Transaction signature
 */
export declare function setPolicy(params: {
    connection: Connection;
    authority: Keypair;
    privateState: PublicKey;
    policy: UpdatePolicy;
}): Promise<string>;
/**
 * CPI-friendly validator. Asserts commitment + nonce without mutation.
 * The payer signs to cover fees.
 *
 * @returns Transaction signature
 */
export declare function assertState(params: {
    connection: Connection;
    payer: Keypair;
    privateState: PublicKey;
    expectedCommitment: Buffer;
    expectedNonce: bigint;
}): Promise<string>;
export type PrivateStateAccount = {
    authority: PublicKey;
    commitment: Buffer;
    nonce: bigint;
    policy: UpdatePolicy;
};
/**
 * Manual account decoding (skip discriminator).
 *
 * Layout:
 * - authority: 32 bytes
 * - commitment: 32 bytes
 * - nonce: u64 LE
 * - policy: u8
 */
export declare function decodePrivateState(data: Buffer): PrivateStateAccount;
/**
 * Fetch and decode on-chain PrivateState.
 *
 * @returns Decoded account or null if missing
 */
export declare function readOnchainState(connection: Connection, privateState: PublicKey): Promise<PrivateStateAccount | null>;
/**
 * WebSocket subscription for account changes.
 *
 * @returns Subscription id
 */
export declare function watchState(connection: Connection, privateState: PublicKey, onChange: (state: PrivateStateAccount) => void): number;
