import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { decryptPayload } from "../sdk/index";
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

type ChainState = {
  nonce: bigint;
  commitmentHex: string;
  authority: string;
};

const STATE_DIR = path.join(process.cwd(), "state");
const COMMITTED_PATH = path.join(STATE_DIR, "state.committed.json");
const PENDING_PATH = path.join(STATE_DIR, "state.pending.json");
const DEMO_KEY_PATH = path.join(process.cwd(), "demo-key.json");

function decodeAccount(data: Buffer): ChainState {
  const authority = new PublicKey(data.subarray(8, 40)).toBase58();
  const commitmentHex = Buffer.from(data.subarray(40, 72)).toString("hex");
  const nonce = data.readBigUInt64LE(72);
  return { nonce, commitmentHex, authority };
}

function payloadToPacked(payload: CommittedState["payload"]): Buffer {
  const iv = Buffer.from(payload.ivHex, "hex");
  const tag = Buffer.from(payload.tagHex, "hex");
  const ciphertext = Buffer.from(payload.ciphertextHex, "hex");
  return Buffer.concat([iv, tag, ciphertext]);
}

async function render(chain: ChainState | null) {
  const committed = await readJsonIfExists<CommittedState>(COMMITTED_PATH);
  const pending = await readJsonIfExists<PendingState>(PENDING_PATH);
  const keyFile = await readJsonIfExists<DemoKey>(DEMO_KEY_PATH);

  if (!chain) {
    console.log("CHAIN: missing");
    return;
  }
  if (!committed) {
    console.log("LOCAL: missing committed state");
    return;
  }

  const committedNonce = BigInt(committed.nonce);
  const chainMatchesCommitted =
    chain.nonce === committedNonce &&
    chain.commitmentHex === committed.commitmentHex;

  const pendingMatchesChain =
    pending &&
    chain.nonce === BigInt(pending.toNonce) &&
    chain.commitmentHex === pending.newCommitmentHex;

  let status = "UNKNOWN";
  if (committedNonce > chain.nonce) {
    status = "DIVERGED";
  } else if (pendingMatchesChain) {
    status = "LANDED_PENDING";
  } else if (chainMatchesCommitted && pending) {
    status = "PENDING";
  } else if (chainMatchesCommitted) {
    status = "IN_SYNC";
  } else if (
    chain.nonce > committedNonce ||
    chain.commitmentHex !== committed.commitmentHex
  ) {
    status = "STALE";
  }

  console.log(
    "STATUS:",
    status,
    "chain_nonce",
    chain.nonce.toString(),
    "chain_commitment",
    chain.commitmentHex.slice(0, 12),
    "local_nonce",
    committed.nonce,
    "local_commitment",
    committed.commitmentHex.slice(0, 12)
  );

  if (status === "LANDED_PENDING" && pending) {
    const promoted: CommittedState = {
      version: 1,
      statePubkey: committed.statePubkey,
      nonce: pending.toNonce,
      commitmentHex: pending.newCommitmentHex,
      payload: pending.newPayload,
    };
    await writeJsonAtomic(COMMITTED_PATH, promoted);
    await removeIfExists(PENDING_PATH);
    console.log("PROMOTED pending -> committed");
  }

  if (keyFile) {
    const packed = payloadToPacked(committed.payload);
    const key = Buffer.from(keyFile.keyBase64, "base64");
    const plaintext = decryptPayload(key, packed);
    const decoded = JSON.parse(plaintext.toString("utf8")) as {
      counter: number;
    };
    console.log("Decrypted counter:", decoded.counter);
  }
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  if (!fs.existsSync(STATE_DIR)) {
    throw new Error("Missing state directory. Run init.ts first.");
  }

  const committed = await readJsonIfExists<CommittedState>(COMMITTED_PATH);
  if (!committed) {
    throw new Error("Missing state.committed.json. Run init.ts first.");
  }

  const privateState = new PublicKey(committed.statePubkey);

  let chainState: ChainState | null = null;
  const accountInfo = await connection.getAccountInfo(privateState, "confirmed");
  if (accountInfo) {
    chainState = decodeAccount(Buffer.from(accountInfo.data));
    console.log(
      "Current:",
      "nonce",
      chainState.nonce.toString(),
      "commitment",
      chainState.commitmentHex
    );
  }
  await render(chainState);

  console.log("Watching on-chain updates...");
  connection.onAccountChange(
    privateState,
    (info) => {
      chainState = decodeAccount(Buffer.from(info.data));
      void render(chainState);
    },
    "confirmed"
  );

  let timer: NodeJS.Timeout | null = null;
  const scheduleRender = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void render(chainState);
    }, 80);
  };

  fs.watch(STATE_DIR, scheduleRender);
  fs.watch(process.cwd(), (event, filename) => {
    if (filename === "demo-key.json") scheduleRender();
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
