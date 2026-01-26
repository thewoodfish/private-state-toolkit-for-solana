import { Connection, Keypair } from "@solana/web3.js";
import { randomBytes } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { commitment, encryptPayload, initPrivateState } from "../sdk/index";
import { writeJsonAtomic } from "./fs_atomic";

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

type DemoKey = {
  version: 1;
  keyBase64: string;
};

const STATE_DIR = path.join(process.cwd(), "state");
const COMMITTED_PATH = path.join(STATE_DIR, "state.committed.json");
const DEMO_KEY_PATH = path.join(process.cwd(), "demo-key.json");

function loadAuthorityKeypair(): Keypair {
  const keypairPath =
    process.env.PST_AUTHORITY_KEYPAIR ||
    path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(keypairPath, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const authority = loadAuthorityKeypair();

  const privateState = Keypair.generate();
  const encryptionKey = randomBytes(32);

  const counterState = Buffer.from(JSON.stringify({ counter: 0 }));
  const { payload, packed } = encryptPayload(encryptionKey, counterState);
  const nonce = 0n;
  const commit = commitment(nonce, packed);

  const sig = await initPrivateState({
    connection,
    authority,
    privateState,
    initialCommitment: commit,
  });

  const committed: CommittedState = {
    version: 1,
    statePubkey: privateState.publicKey.toBase58(),
    nonce: nonce.toString(),
    commitmentHex: commit.toString("hex"),
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

  console.log("Initialized Private State");
  console.log("Signature:", sig);
  console.log("State account:", privateState.publicKey.toBase58());
  console.log("Saved:", COMMITTED_PATH);
  console.log("Key:", DEMO_KEY_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
