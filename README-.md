# Private State Toolkit (PST)

Private State Toolkit is **privacy infrastructure for Solana programs**. It enables **private but verifiable application state without zk** by storing only cryptographic commitments on-chain and keeping the encrypted state off-chain. This is **not** a private payments app — it’s a reusable primitive for builders.

---

## Why this exists

Many Solana apps need **integrity** without **public data leakage**:
- Games with hidden state
- Identity attestations or claims
- App configuration or secrets
- Collaborative apps with private state

PST gives you:
- **On-chain verifiability** (hash commitment + nonce)
- **Off-chain privacy** (encrypted payload stays with the app/user)
- **Minimal on-chain footprint** (cheap, indexer‑resistant)

---

## Core idea

1. App encrypts state locally (AES‑256‑GCM).
2. It computes `commitment = sha256(nonce || encrypted_payload)`.
3. On-chain account stores only:
   - `authority`
   - `commitment`
   - `nonce`
4. Update is valid only if:
   - `old_commitment` matches
   - `nonce` increments by exactly 1

Everyone can verify ordering and consistency — **no one sees the payload** without the key.

---

## What’s on-chain

**Program:** `private_state_toolkit`

Account:
```rust
#[account]
pub struct PrivateState {
  pub authority: Pubkey,
  pub commitment: [u8; 32],
  pub nonce: u64
}
```

Instructions:
- `initialize(initial_commitment)`
- `update(old_commitment, new_commitment, next_nonce)`
- `transfer_authority(new_authority)`

Constraints:
- No zk
- No PDAs
- No external programs
- Minimal account size (8 + 32 + 32 + 8 bytes)

---

## Local/Chain Sync Protocol (2‑phase)

PST uses a **two‑phase local protocol** to avoid race conditions and “sleep and retry” hacks:

Files:
- `state/state.committed.json` = last confirmed state (local source of truth)
- `state/state.pending.json` = staged update awaiting confirmation
- `demo-key.json` = demo encryption key

Flow:
1. `inc.ts` writes `state.pending.json` **before** submitting the transaction.
2. After the tx is **confirmed**, it **atomically promotes** to `state.committed.json`.
3. `watch.ts` treats chain nonce/commitment as the source of truth and emits status:
   - `IN_SYNC` — chain == committed
   - `PENDING` — pending exists, chain == committed
   - `LANDED_PENDING` — chain == pending (auto‑promote)
   - `STALE` — chain ahead of committed
   - `DIVERGED` — local ahead of chain (should not happen)

This keeps local state consistent even under websocket lag or tx failure.

---

## Demo: Private Counter (Mandatory)

**What it proves**
- Counter value is **encrypted locally**
- On‑chain only stores **commitment + nonce**
- Real‑time updates via WebSocket subscriptions
- Observer can verify updates but **cannot decrypt**

### Prereqs
- Solana CLI configured
- Node + ts-node

### Install deps
```bash
npm i @coral-xyz/anchor @solana/web3.js
npm i -D ts-node typescript
```

### Run (devnet)
```bash
export PST_PROGRAM_ID=<deployed_program_id>
export SOLANA_RPC_URL=https://api.devnet.solana.com

# terminal 1
npx ts-node scripts/init.ts

# terminal 2
TS_NODE_CACHE=false npx ts-node scripts/watch.ts

# terminal 3
npx ts-node scripts/inc.ts
npx ts-node scripts/inc.ts

# optional observer (no key)
TS_NODE_CACHE=false npx ts-node scripts/observer.ts
```

### Inspect pending vs committed
```bash
ls state
cat state/state.pending.json
cat state/state.committed.json
```

You should see:
- `state.pending.json` appear immediately on `inc.ts` start
- `state.committed.json` update only after confirmation

---

## SDK highlights
- AES‑256‑GCM encryption helpers
- Commitment hash = `sha256(nonce || payload)`
- Manual account decoding (skip discriminator, parse u64 LE)
- WebSocket subscription helper

---

## Why indexers can’t see your data
Indexers (Helius, etc.) only see:
- Account authority
- Commitment hash
- Nonce increments

They **cannot** derive or decrypt the payload without the key.

---

## Honest limitations
- This is **not anonymity** — observers still see account + update cadence
- Payload durability depends on your off‑chain storage
- No zk proofs — integrity is commitment‑based only

---

## Project structure
```
programs/private_state_toolkit/src/lib.rs
sdk/index.ts
scripts/init.ts
scripts/inc.ts
scripts/watch.ts
scripts/observer.ts
scripts/fs_atomic.ts
README.md
```

---

## Hackathon pitch (one‑liner)
**PST makes private state easy on Solana: verifiable updates on‑chain, encrypted data off‑chain, zero zk complexity.**
