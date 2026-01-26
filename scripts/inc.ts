import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";
import os from "os";
import path from "path";
import {
  commitment,
  decryptPayload,
  encryptPayload,
  readOnchainState,
  updatePrivateState,
} from "../sdk/index";
import { readJsonIfExists, removeIfExists, writeJsonAtomic } from "./fs_atomic";

type CommittedState = {
  version: 1;
  statePubkey: string;
  nonce: string;
  commitmentHex: string;
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

function loadAuthorityKeypair(): Keypair {
  const keypairPath =
    process.env.PST_AUTHORITY_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function payloadToPacked(payload: CommittedState["payload"]): Buffer {
  const iv = Buffer.from(payload.ivHex, "hex");
  const tag = Buffer.from(payload.tagHex, "hex");
  const ciphertext = Buffer.from(payload.ciphertextHex, "hex");
  return Buffer.concat([iv, tag, ciphertext]);
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const authority = loadAuthorityKeypair();

  const committed = await readJsonIfExists<CommittedState>(COMMITTED_PATH);
  if (!committed) {
    throw new Error("Run init first (missing state.committed.json).");
  }
  const existingPending = await readJsonIfExists<PendingState>(PENDING_PATH);
  if (existingPending) {
    console.log("PENDING_EXISTS");
    console.log("Resolve state.pending.json before creating a new update.");
    return;
  }
  const keyFile = await readJsonIfExists<DemoKey>(DEMO_KEY_PATH);
  if (!keyFile) {
    throw new Error("Missing demo-key.json.");
  }

  const privateState = new PublicKey(committed.statePubkey);
  const encryptionKey = Buffer.from(keyFile.keyBase64, "base64");
  const packedPayload = payloadToPacked(committed.payload);

  const onchain = await readOnchainState(connection, privateState);
  if (!onchain) {
    throw new Error("On-chain state not found.");
  }

  const chainNonce = onchain.nonce;
  const chainCommitmentHex = onchain.commitment.toString("hex");
  if (
    chainNonce.toString() !== committed.nonce ||
    chainCommitmentHex !== committed.commitmentHex
  ) {
    console.log("LOCAL_STALE");
    console.log("Chain nonce:", chainNonce.toString());
    console.log("Chain commitment:", chainCommitmentHex);
    console.log("Local nonce:", committed.nonce);
    console.log("Local commitment:", committed.commitmentHex);
    console.log("Resolve by syncing local state or re-running init.");
    return;
  }

  const plaintext = decryptPayload(encryptionKey, packedPayload);
  const decoded = JSON.parse(plaintext.toString("utf8")) as { counter: number };
  const nextCounter = decoded.counter + 1;

  const nextPayload = Buffer.from(JSON.stringify({ counter: nextCounter }));
  const { payload: newPayload, packed: nextPacked } = encryptPayload(
    encryptionKey,
    nextPayload
  );

  const nextNonce = chainNonce + 1n;
  const newCommitment = commitment(nextNonce, nextPacked);

  const pending: PendingState = {
    version: 1,
    statePubkey: committed.statePubkey,
    fromNonce: chainNonce.toString(),
    toNonce: nextNonce.toString(),
    oldCommitmentHex: chainCommitmentHex,
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

  let sig = "";
  try {
    sig = await updatePrivateState({
      connection,
      authority,
      privateState,
      oldCommitment: onchain.commitment,
      newCommitment,
      nextNonce,
    });

    await writeJsonAtomic(PENDING_PATH, { ...pending, txSig: sig });

    const confirmation = await connection.confirmTransaction(sig, "confirmed");
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
    }

    const committedNext: CommittedState = {
      version: 1,
      statePubkey: committed.statePubkey,
      nonce: nextNonce.toString(),
      commitmentHex: newCommitment.toString("hex"),
      payload: {
        ivHex: newPayload.iv.toString("hex"),
        ciphertextHex: newPayload.ciphertext.toString("hex"),
        tagHex: newPayload.tag.toString("hex"),
      },
    };

    await writeJsonAtomic(COMMITTED_PATH, committedNext);
    await removeIfExists(PENDING_PATH);

    console.log(`COMMITTED nonce=${nextNonce.toString()} sig=${sig}`);
    console.log("Counter:", nextCounter);
  } catch (err) {
    await removeIfExists(PENDING_PATH);
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
