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

const DISCRIMINATOR = {
  initialize: Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),
  update: Buffer.from([219, 200, 88, 176, 158, 63, 253, 127]),
  transferAuthority: Buffer.from([35, 150, 249, 253, 241, 46, 101, 64]),
  assertState: Buffer.from([38, 168, 44, 85, 125, 248, 167, 163]),
  setPolicy: Buffer.from([49, 72, 252, 13, 103, 119, 4, 236]),
};

export function getProgramId(): PublicKey {
  const value = process.env.PST_PROGRAM_ID;
  if (!value) {
    throw new Error("PST_PROGRAM_ID env var is required.");
  }
  return new PublicKey(value);
}

export function commitment(nonce: bigint, encryptedPayload: Buffer): Buffer {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(nonce);
  return createHash("sha256")
    .update(Buffer.concat([nonceBuf, encryptedPayload]))
    .digest();
}

export type EncryptedPayload = {
  iv: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
};

export enum UpdatePolicy {
  StrictSequential = 0,
  AllowSkips = 1,
}

export function encryptPayload(
  key: Buffer,
  plaintext: Buffer
): { payload: EncryptedPayload; packed: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = packEncryptedPayload({ iv, tag, ciphertext });
  return { payload: { iv, tag, ciphertext }, packed };
}

export function decryptPayload(key: Buffer, packed: Buffer): Buffer {
  const { iv, tag, ciphertext } = unpackEncryptedPayload(packed);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function packEncryptedPayload(payload: EncryptedPayload): Buffer {
  return Buffer.concat([payload.iv, payload.tag, payload.ciphertext]);
}

export function unpackEncryptedPayload(packed: Buffer): EncryptedPayload {
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  return { iv, tag, ciphertext };
}

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

export function decodePrivateState(data: Buffer): PrivateStateAccount {
  const offset = 8;
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  const commitmentBuf = data.subarray(offset + 32, offset + 64);
  const nonce = data.readBigUInt64LE(offset + 64);
  const policy = data.readUInt8(offset + 72) as UpdatePolicy;
  return { authority, commitment: Buffer.from(commitmentBuf), nonce, policy };
}

export async function readOnchainState(
  connection: Connection,
  privateState: PublicKey
): Promise<PrivateStateAccount | null> {
  const info = await connection.getAccountInfo(privateState, "confirmed");
  if (!info) return null;
  return decodePrivateState(Buffer.from(info.data));
}

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
