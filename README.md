# Private State Toolkit (PST)

Private State Toolkit (PST) is **privacy infrastructure for Solana programs**.  
It enables **private but verifiable application state without zero-knowledge proofs (zk)** by storing **only cryptographic commitments on-chain** and keeping the **encrypted state off-chain**.

> This is **not** a private payments app.  
> PST is a **reusable primitive** for Solana developers who want integrity without public data leakage.

---

## Why this exists

Many Solana applications need **correctness and ordering guarantees** without exposing sensitive state:

- Games with hidden scores or strategies  
- Reputation or credit-style systems  
- DAO voting weights or configuration  
- Collaborative apps with private shared state  

Current options force developers into bad tradeoffs:

| Option | Problem |
|------|--------|
| Store state on-chain | Fully public forever |
| Store state off-chain | No verifiability |
| Use zk | Heavy complexity, high risk, poor hackathon ergonomics |

**PST introduces a fourth option: private but verifiable state.**

---

## Core idea

1. The application encrypts its state locally (AES-256-GCM).
2. It computes a commitment:  
   `commitment = sha256(nonce || encrypted_payload)`
3. The on-chain account stores only:
   - `authority`
   - `commitment`
   - `nonce`
4. An update is accepted only if:
   - `old_commitment` matches the stored value
   - `nonce` increments by exactly 1
   - the authority signs

The program **never sees plaintext state**.  
Anyone can verify that updates are **authorized, ordered, and consistent**.

> **Important clarification:**  
> The program does *not* verify knowledge of the plaintext or ciphertext.  
> It enforces **authorized, monotonic transitions between commitments**.

---

## What’s on-chain

**Program:** `private_state_toolkit`

### Account
```rust
#[account]
pub struct PrivateState {
    pub authority: Pubkey,
    pub commitment: [u8; 32],
    pub nonce: u64,
}
```

### Instructions
- `initialize(initial_commitment)`
- `update(old_commitment, new_commitment, next_nonce)`
- `transfer_authority(new_authority)`

### Constraints
- No zk
- No PDAs
- No external programs
- Minimal account size (8 + 32 + 32 + 8 bytes)

---

## Local / Chain Sync Protocol (Two‑Phase)

PST includes a **robust local coordination protocol** to avoid race conditions, watcher lag, and brittle “sleep-and-retry” hacks.

### Files
- `state/state.committed.json` — last confirmed local state  
- `state/state.pending.json` — staged update awaiting confirmation  
- `demo-key.json` — demo encryption key  

### Flow
1. `inc.ts` writes `state.pending.json` **before** submitting the transaction.
2. After the transaction is **confirmed**, it atomically promotes the update to `state.committed.json`.
3. `watch.ts` and `observer.ts` treat the **on-chain nonce + commitment as the source of truth** and emit sync status:

| Status | Meaning |
|------|--------|
| `IN_SYNC` | Chain matches committed |
| `PENDING` | Pending exists, chain unchanged |
| `LANDED_PENDING` | Chain matches pending (auto-promote) |
| `STALE` | Chain ahead of local |
| `DIVERGED` | Local ahead of chain (should not occur) |

This keeps local state correct even under WebSocket lag or transaction failure.

---

## Demo: Private Counter

This demo proves the primitive works end-to-end.

### What it demonstrates
- Counter value is **encrypted locally**
- On-chain stores **only commitment + nonce**
- Real-time updates via WebSocket subscriptions
- Observers can verify updates but **cannot decrypt state**

### Prerequisites
- Solana CLI configured
- Node.js + ts-node

### Install dependencies
```bash
npm install @coral-xyz/anchor @solana/web3.js
npm install -D ts-node typescript
```

### Run (Devnet)
```bash
export PST_PROGRAM_ID=<deployed_program_id>
export SOLANA_RPC_URL=https://api.devnet.solana.com

# Terminal 1
npx ts-node scripts/init.ts

# Terminal 2
TS_NODE_CACHE=false npx ts-node scripts/watch.ts

# Terminal 3
npx ts-node scripts/inc.ts
npx ts-node scripts/inc.ts

# Optional observer (no key)
TS_NODE_CACHE=false npx ts-node scripts/observer.ts
```

### Inspect local state
```bash
ls state
cat state/state.pending.json
cat state/state.committed.json
```

Expected behavior:
- `state.pending.json` appears immediately on update
- `state.committed.json` updates only after confirmation

---

## SDK highlights

- AES‑256‑GCM encryption helpers
- Commitment hash: `sha256(nonce || payload)`
- Manual account decoding (skip discriminator, parse u64 LE)
- WebSocket subscription utilities
- No indexer required

---

## How other programs use PST

A Solana program can store a **Pubkey reference** to a `PrivateState` account instead of storing plaintext state.

The program:
- checks authority and nonce
- enforces ordering
- proceeds without ever reading private data

Example use cases:
- Private game state
- Private reputation scores
- Private DAO voting weight

---

## Why indexers can’t see your data

Indexers (Helius, etc.) only observe:
- Account authority
- Commitment hashes
- Nonce increments

They **cannot derive or decrypt** the underlying state without the encryption key.

---

## Honest limitations

- This does **not** provide anonymity
- Transaction metadata remains visible
- Payload durability depends on off-chain storage
- No zk proofs — integrity is commitment-based only

These tradeoffs are intentional for simplicity and developer ergonomics.

---

## Project structure
```text
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

**Private State Toolkit makes privacy practical on Solana:  
verifiable updates on-chain, encrypted data off-chain, zero zk complexity.**
