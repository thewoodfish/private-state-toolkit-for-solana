/**
 * Private State Toolkit (PST) - TypeScript SDK
 *
 * Client-side utilities for interacting with the PST Solana program.
 * Handles encryption, commitment computation, and transaction building.
 *
 * @module pst-sdk
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * Anchor instruction discriminators (first 8 bytes of instruction data).
 * These identify which instruction to call on the program.
 */
const DISCRIMINATOR = {
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
export function getProgramId(): PublicKey {
  const value = process.env.PST_PROGRAM_ID;
  if (!value) {
    throw new Error("PST_PROGRAM_ID env var is required.");
  }
  return new PublicKey(value);
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
export function commitment(nonce: bigint, encryptedPayload: Buffer): Buffer {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce);
  return createHash("sha256")
    .update(Buffer.concat([nonceBuf, encryptedPayload]))
    .digest();
}

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
export enum UpdatePolicy {
  /** Nonce must increment by exactly 1 (turn-based, deterministic) */
  StrictSequential = 0,
  /** Nonce must increase but can skip values (async, offline-friendly) */
  AllowSkips = 1,
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
export function encryptPayload(
  key: Buffer,
  plaintext: Buffer
): { payload: EncryptedPayload; packed: Buffer } {
  const iv = randomBytes(12); // Random IV for each encryption
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // GCM authentication tag
  const packed = packEncryptedPayload({ iv, tag, ciphertext });
  return { payload: { iv, tag, ciphertext }, packed };
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
export function decryptPayload(key: Buffer, packed: Buffer): Buffer {
  const { iv, tag, ciphertext } = unpackEncryptedPayload(packed);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
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
export function packEncryptedPayload(payload: EncryptedPayload): Buffer {
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
export function unpackEncryptedPayload(packed: Buffer): EncryptedPayload {
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  return { iv, tag, ciphertext };
}

/**
 * Initialize a new PST account (non-PDA).
 *
 * @param params.initialCommitment - sha256(nonce || encrypted_payload) at nonce 0
 * @param params.policy - Update policy enforced on-chain
 * @returns Transaction signature
 */
export async function initPrivateState(params: {
  connection: Connection;
  authority: Keypair;
  privateState: Keypair;
  initialCommitment: Buffer;
  policy: UpdatePolicy;
}): Promise<string> {
  const ix = new TransactionInstruction({
    programId: getProgramId(),
    keys: [
      {
        pubkey: params.privateState.publicKey,
        isSigner: true,
        isWritable: true,
      },
      { pubkey: params.authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      DISCRIMINATOR.initialize,
      params.initialCommitment,
      Buffer.from([params.policy]),
    ]),
  });
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(params.connection, tx, [
    params.authority,
    params.privateState,
  ]);
}

/**
 * Update commitment + nonce with policy enforcement on-chain.
 *
 * @param params.oldCommitment - Must match stored commitment
 * @param params.newCommitment - New commitment hash
 * @param params.nextNonce - Candidate nonce (checked against policy)
 * @returns Transaction signature
 */
export async function updatePrivateState(params: {
  connection: Connection;
  authority: Keypair;
  privateState: PublicKey;
  oldCommitment: Buffer;
  newCommitment: Buffer;
  nextNonce: bigint;
}): Promise<string> {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(params.nextNonce);
  const ix = new TransactionInstruction({
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
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(params.connection, tx, [params.authority]);
}

/**
 * Update the policy byte (authority signer required).
 *
 * @returns Transaction signature
 */
export async function setPolicy(params: {
  connection: Connection;
  authority: Keypair;
  privateState: PublicKey;
  policy: UpdatePolicy;
}): Promise<string> {
  const ix = new TransactionInstruction({
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
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(params.connection, tx, [params.authority]);
}

/**
 * CPI-friendly validator. Asserts commitment + nonce without mutation.
 * The payer signs to cover fees.
 *
 * @returns Transaction signature
 */
export async function assertState(params: {
  connection: Connection;
  payer: Keypair;
  privateState: PublicKey;
  expectedCommitment: Buffer;
  expectedNonce: bigint;
}): Promise<string> {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(params.expectedNonce);
  const ix = new TransactionInstruction({
    programId: getProgramId(),
    keys: [{ pubkey: params.privateState, isSigner: false, isWritable: false }],
    data: Buffer.concat([
      DISCRIMINATOR.assertState,
      params.expectedCommitment,
      nonceBuf,
    ]),
  });
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(params.connection, tx, [params.payer]);
}

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
export function decodePrivateState(data: Buffer): PrivateStateAccount {
  const offset = 8;
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  const commitmentBuf = data.subarray(offset + 32, offset + 64);
  const nonce = data.readBigUInt64LE(offset + 64);
  const policy = data.readUInt8(offset + 72) as UpdatePolicy;
  return { authority, commitment: Buffer.from(commitmentBuf), nonce, policy };
}

/**
 * Fetch and decode on-chain PrivateState.
 *
 * @returns Decoded account or null if missing
 */
export async function readOnchainState(
  connection: Connection,
  privateState: PublicKey
): Promise<PrivateStateAccount | null> {
  const info = await connection.getAccountInfo(privateState, "confirmed");
  if (!info) return null;
  return decodePrivateState(Buffer.from(info.data));
}

/**
 * WebSocket subscription for account changes.
 *
 * @returns Subscription id
 */
export function watchState(
  connection: Connection,
  privateState: PublicKey,
  onChange: (state: PrivateStateAccount) => void
): number {
  return connection.onAccountChange(
    privateState,
    (info) => {
      const decoded = decodePrivateState(Buffer.from(info.data));
      onChange(decoded);
    },
    "confirmed"
  );
}
