// Observer: same sync status as watch.ts, without decryption.
import "./env"; // Load environment variables
import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { readJsonIfExists, writeJsonAtomic } from "./fs_atomic";

type CommittedState = {
  version: 1;
  statePubkey: string;
  nonce: string;
  commitmentHex: string;
  policy: number;
};

type PendingState = {
  version: 1;
  statePubkey: string;
  fromNonce: string;
  toNonce: string;
  oldCommitmentHex: string;
  newCommitmentHex: string;
  txSig: string;
  createdAt: string;
};

type ChainState = {
  nonce: bigint;
  commitmentHex: string;
  policy: number;
  authority: string;
};

const STATE_DIR = path.join(process.cwd(), "state");
const COMMITTED_PATH = path.join(STATE_DIR, "state.committed.json");
const PENDING_PATH = path.join(STATE_DIR, "state.pending.json");

function decodeAccount(data: Buffer): ChainState {
  const authority = new PublicKey(data.subarray(8, 40)).toBase58();
  const commitmentHex = Buffer.from(data.subarray(40, 72)).toString("hex");
  const nonce = data.readBigUInt64LE(72);
  const policy = data.readUInt8(80);
  return { nonce, commitmentHex, policy, authority };
}

async function render(chain: ChainState | null) {
  // Read committed/pending for sync status (no keys required).
  const committed = await readJsonIfExists<CommittedState>(COMMITTED_PATH);
  const pending = await readJsonIfExists<PendingState>(PENDING_PATH);

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
    chain.commitmentHex === committed.commitmentHex &&
    chain.policy === committed.policy;

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
    chain.commitmentHex !== committed.commitmentHex ||
    chain.policy !== committed.policy
  ) {
    status = "STALE";
  }

  const policyLabel = chain.policy === 0 ? "strict" : "allow_skips";
  console.log(
    "STATUS:",
    status,
    "chain_nonce",
    chain.nonce.toString(),
    "chain_commitment",
    chain.commitmentHex.slice(0, 12),
    "policy",
    policyLabel,
    "local_nonce",
    committed.nonce,
    "local_commitment",
    committed.commitmentHex.slice(0, 12)
  );

  if (
    chain.nonce === committedNonce &&
    chain.commitmentHex === committed.commitmentHex &&
    chain.policy !== committed.policy
  ) {
    const synced: CommittedState = { ...committed, policy: chain.policy };
    await writeJsonAtomic(COMMITTED_PATH, synced);
    console.log("SYNCED policy to chain");
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

  console.log("Observing on-chain updates (no decryption key)...");
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
