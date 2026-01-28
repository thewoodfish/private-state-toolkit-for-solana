// CPI demo: pst_consumer gates action by calling PST assert_state.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { randomBytes } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
  UpdatePolicy,
  commitment,
  decryptPayload,
  encryptPayload,
  initPrivateState,
  readOnchainState,
  updatePrivateState,
} from "../sdk/index";
import { readJsonIfExists, removeIfExists, writeJsonAtomic } from "./fs_atomic";

type CommittedState = {
  version: 1;
  statePubkey: string;
  nonce: string;
  commitmentHex: string;
  policy: number;
  payload: {
    ivHex: string;
    ciphertextHex: string;
    tagHex: string;
  };
};

type PendingState = {
  version: 1;
  statePubkey: string;
  fromNonce: string;
  toNonce: string;
  oldCommitmentHex: string;
  newCommitmentHex: string;
  newPayload: {
    ivHex: string;
    ciphertextHex: string;
    tagHex: string;
  };
  txSig: string;
  createdAt: string;
};

type DemoKey = {
  version: 1;
  keyBase64: string;
};

const STATE_DIR = path.join(process.cwd(), "state");
const COMMITTED_PATH = path.join(STATE_DIR, "state.committed.json");
const PENDING_PATH = path.join(STATE_DIR, "state.pending.json");
const DEMO_KEY_PATH = path.join(process.cwd(), "demo-key.json");

const CONSUMER_PROGRAM_ID = new PublicKey(
  process.env.PST_CONSUMER_PROGRAM_ID ||
    "BxqCdUzNrMifua7Rd3qQSqgd4oyTzdcTqH1tbYuvi5bf"
);

const DISCRIMINATOR = {
  initializeConsumer: Buffer.from([228, 176, 96, 150, 209, 224, 65, 98]),
  gatedAction: Buffer.from([98, 180, 13, 198, 77, 45, 170, 51]),
};

function loadAuthorityKeypair(): Keypair {
  const keypairPath =
    process.env.PST_AUTHORITY_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function parsePolicy(): UpdatePolicy {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((arg) => arg === "--policy");
  const raw =
    (idx >= 0 ? argv[idx + 1] : undefined) ||
    process.env.POLICY ||
    "strict";
  const normalized = raw.toLowerCase();
  if (normalized === "allow_skips" || normalized === "allow" || normalized === "skips") {
    return UpdatePolicy.AllowSkips;
  }
  return UpdatePolicy.StrictSequential;
}

function payloadToPacked(payload: CommittedState["payload"]): Buffer {
  const iv = Buffer.from(payload.ivHex, "hex");
  const tag = Buffer.from(payload.tagHex, "hex");
  const ciphertext = Buffer.from(payload.ciphertextHex, "hex");
  return Buffer.concat([iv, tag, ciphertext]);
}

// Initialize consumer program account with a PST state reference.
async function initializeConsumerAccount(params: {
  connection: Connection;
  authority: Keypair;
  consumer: Keypair;
  privateState: PublicKey;
}): Promise<string> {
  const ix = new TransactionInstruction({
    programId: CONSUMER_PROGRAM_ID,
    keys: [
      { pubkey: params.consumer.publicKey, isSigner: true, isWritable: true },
      { pubkey: params.authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([
      DISCRIMINATOR.initializeConsumer,
      params.privateState.toBuffer(),
    ]),
  });
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(params.connection, tx, [
    params.authority,
    params.consumer,
  ]);
}

// CPI into PST assert_state and increment consumer count if valid.
async function gatedAction(params: {
  connection: Connection;
  authority: Keypair;
  consumer: PublicKey;
  privateState: PublicKey;
  expectedCommitment: Buffer;
  expectedNonce: bigint;
}): Promise<string> {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(params.expectedNonce);
  const ix = new TransactionInstruction({
    programId: CONSUMER_PROGRAM_ID,
    keys: [
      { pubkey: params.consumer, isSigner: false, isWritable: true },
      { pubkey: params.privateState, isSigner: false, isWritable: false },
      { pubkey: new PublicKey(process.env.PST_PROGRAM_ID || ""), isSigner: false, isWritable: false },
      { pubkey: params.authority.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([
      DISCRIMINATOR.gatedAction,
      params.expectedCommitment,
      nonceBuf,
    ]),
  });
  const tx = new Transaction().add(ix);
  return sendAndConfirmTransaction(params.connection, tx, [params.authority]);
}

async function main() {
  if (!process.env.PST_PROGRAM_ID) {
    throw new Error("PST_PROGRAM_ID env var is required.");
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const authority = loadAuthorityKeypair();
  const policy = parsePolicy();

  // 1) Initialize PST private counter.
  console.log("Initializing PST state...");
  const privateState = Keypair.generate();
  const encryptionKey = randomBytes(32);
  const counterState = Buffer.from(JSON.stringify({ counter: 0 }));
  const { payload, packed } = encryptPayload(encryptionKey, counterState);
  const nonce = 0n;
  const commit = commitment(nonce, packed);

  const initSig = await initPrivateState({
    connection,
    authority,
    privateState,
    initialCommitment: commit,
    policy,
  });

  const committed: CommittedState = {
    version: 1,
    statePubkey: privateState.publicKey.toBase58(),
    nonce: nonce.toString(),
    commitmentHex: commit.toString("hex"),
    policy,
    payload: {
      ivHex: payload.iv.toString("hex"),
      ciphertextHex: payload.ciphertext.toString("hex"),
      tagHex: payload.tag.toString("hex"),
    },
  };

  const demoKey: DemoKey = {
    version: 1,
    keyBase64: encryptionKey.toString("base64"),
  };

  await writeJsonAtomic(COMMITTED_PATH, committed);
  await writeJsonAtomic(DEMO_KEY_PATH, demoKey);
  await removeIfExists(PENDING_PATH);

  console.log("PST init sig:", initSig);
  console.log("PST state:", privateState.publicKey.toBase58());

  // 2) Initialize consumer account that references PST state.
  console.log("Initializing consumer program...");
  const consumer = Keypair.generate();
  const consumerSig = await initializeConsumerAccount({
    connection,
    authority,
    consumer,
    privateState: privateState.publicKey,
  });
  console.log("Consumer init sig:", consumerSig);
  console.log("Consumer account:", consumer.publicKey.toBase58());

  const chain = await readOnchainState(connection, privateState.publicKey);
  if (!chain) throw new Error("Missing PST state on-chain.");

  // 3) Gate action with current commitment/nonce (should succeed).
  console.log("Calling gated_action with current commitment/nonce...");
  const gateSig1 = await gatedAction({
    connection,
    authority,
    consumer: consumer.publicKey,
    privateState: privateState.publicKey,
    expectedCommitment: chain.commitment,
    expectedNonce: chain.nonce,
  });
  console.log("gated_action sig:", gateSig1);

  // 4) Update PST state and call gated_action again.
  console.log("Updating PST state...");
  const keyFile = await readJsonIfExists<DemoKey>(DEMO_KEY_PATH);
  if (!keyFile) throw new Error("Missing demo-key.json");
  const packedPayload = payloadToPacked(committed.payload);
  const key = Buffer.from(keyFile.keyBase64, "base64");
  const plaintext = decryptPayload(key, packedPayload);
  const decoded = JSON.parse(plaintext.toString("utf8")) as { counter: number };
  const nextCounter = decoded.counter + 1;
  const nextPayload = Buffer.from(JSON.stringify({ counter: nextCounter }));
  const { payload: newPayload, packed: nextPacked } = encryptPayload(
    key,
    nextPayload
  );
  const nextNonce = chain.nonce + 1n;
  const newCommitment = commitment(nextNonce, nextPacked);

  const pending: PendingState = {
    version: 1,
    statePubkey: committed.statePubkey,
    fromNonce: chain.nonce.toString(),
    toNonce: nextNonce.toString(),
    oldCommitmentHex: chain.commitment.toString("hex"),
    newCommitmentHex: newCommitment.toString("hex"),
    newPayload: {
      ivHex: newPayload.iv.toString("hex"),
      ciphertextHex: newPayload.ciphertext.toString("hex"),
      tagHex: newPayload.tag.toString("hex"),
    },
    txSig: "",
    createdAt: new Date().toISOString(),
  };
  await writeJsonAtomic(PENDING_PATH, pending);

  const updateSig = await updatePrivateState({
    connection,
    authority,
    privateState: privateState.publicKey,
    oldCommitment: chain.commitment,
    newCommitment,
    nextNonce,
  });
  await writeJsonAtomic(PENDING_PATH, { ...pending, txSig: updateSig });

  await connection.confirmTransaction(updateSig, "confirmed");

  const committedNext: CommittedState = {
    version: 1,
    statePubkey: committed.statePubkey,
    nonce: nextNonce.toString(),
    commitmentHex: newCommitment.toString("hex"),
    policy,
    payload: {
      ivHex: newPayload.iv.toString("hex"),
      ciphertextHex: newPayload.ciphertext.toString("hex"),
      tagHex: newPayload.tag.toString("hex"),
    },
  };
  await writeJsonAtomic(COMMITTED_PATH, committedNext);
  await removeIfExists(PENDING_PATH);
  console.log("PST updated, nonce:", nextNonce.toString());

  const chain2 = await readOnchainState(connection, privateState.publicKey);
  if (!chain2) throw new Error("Missing PST state after update.");
  console.log("Calling gated_action with updated commitment/nonce...");
  const gateSig2 = await gatedAction({
    connection,
    authority,
    consumer: consumer.publicKey,
    privateState: privateState.publicKey,
    expectedCommitment: chain2.commitment,
    expectedNonce: chain2.nonce,
  });
  console.log("gated_action sig:", gateSig2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
