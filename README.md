# Private State Toolkit (PST)

Private State Toolkit is **privacy infrastructure for Solana programs**. It enables **private but verifiable application state without zk** by storing only cryptographic commitments on-chain and keeping encrypted state off-chain. This is **not** a private payments app — it’s a reusable primitive for builders.

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
   - `policy`
4. Update is valid only if:
   - `old_commitment` matches
   - `nonce` rule obeys policy

Everyone can verify ordering and consistency — **no one sees the payload** without the key.

---

## Upgrade A — Composability via CPI (assert_state)

PST now exposes a **CPI‑friendly validation hook**:

```rust
pub fn assert_state(
  ctx: Context<AssertState>,
  expected_commitment: [u8; 32],
  expected_nonce: u64
) -> Result<()>
```

- **Read‑only** (no mutation)
- **Deterministic + cheap**
- Works from **any program** via CPI

### CPI example (from pst_consumer)
```rust
let cpi_accounts = private_state_toolkit::cpi::accounts::AssertState {
    private_state: ctx.accounts.private_state.to_account_info(),
};
let cpi_ctx = CpiContext::new(
    ctx.accounts.pst_program.to_account_info(),
    cpi_accounts,
);
private_state_toolkit::cpi::assert_state(
    cpi_ctx,
    expected_commitment,
    expected_nonce,
)?;
```

This lets any program gate actions on **fresh private state** without decrypting.

---

## Upgrade B — Update policies

PST supports two minimal, real update policies:

```rust
pub enum UpdatePolicy {
  StrictSequential = 0,  // next_nonce == stored_nonce + 1
  AllowSkips = 1,        // next_nonce > stored_nonce
}
```

Why it matters:
- **StrictSequential** for deterministic apps (games, turn‑based state)
- **AllowSkips** for async/offline workflows (batched or delayed updates)

Policies are enforced on-chain during `update` and can be changed via `set_policy`.

---

## Local/Chain Sync Protocol (2‑phase)

PST avoids race conditions with a two‑phase local protocol:

Files:
- `state/state.committed.json` = last confirmed state (local source of truth)
- `state/state.pending.json` = staged update awaiting confirmation
- `demo-key.json` = demo encryption key

Flow:
1. `inc.ts` writes `state.pending.json` **before** submitting the transaction.
2. After confirmation, it **atomically promotes** to `state.committed.json`.
3. `watch.ts` treats chain nonce/commitment as source of truth and emits status:
   - `IN_SYNC` — chain == committed
   - `PENDING` — pending exists, chain == committed
   - `LANDED_PENDING` — chain == pending (auto‑promote)
   - `STALE` — chain ahead of committed
   - `DIVERGED` — local ahead of chain

This avoids “sleep and retry” hacks and works reliably under websocket lag.

---

## Demo: Private Counter (mandatory)

**What it proves**
- Counter value is **encrypted locally**
- On-chain only stores **commitment + nonce + policy**
- Real‑time updates via WebSocket subscriptions
- Observer can verify updates but **cannot decrypt**

### Setup and Installation

### Prerequisites
- Rust 1.75+
- Solana CLI 1.18+
- Anchor CLI 0.30.1
- Node.js 18+

### Install dependencies
```bash
npm install
```

### Build programs
```bash
anchor build
```

### Deploy to devnet
```bash
# Configure Solana CLI for devnet
solana config set --url https://api.devnet.solana.com

# Airdrop SOL for deployment
solana airdrop 2

# Deploy both programs
anchor deploy

# Note the program IDs and update Anchor.toml if different
```

### Run tests
```bash
anchor test
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

### Policy selection
```bash
# strict (default)
POLICY=strict npx ts-node scripts/init.ts

# allow_skips
POLICY=allow_skips npx ts-node scripts/init.ts

# demo skip in allow_skips mode
npx ts-node scripts/inc.ts --skip 3
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

## Demo: CPI consumer (composability)

This demo proves **any program can gate actions** using PST without decrypting.

```bash
export PST_PROGRAM_ID=<deployed_pst_id>
export PST_CONSUMER_PROGRAM_ID=<deployed_consumer_id>
export SOLANA_RPC_URL=https://api.devnet.solana.com

npx ts-node scripts/consumer_demo.ts
```

Flow:
1. Initializes a PST private counter
2. Initializes a consumer program referencing that PST account
3. Calls `gated_action` with expected commitment/nonce (succeeds)
4. Updates PST
5. Calls `gated_action` again with new expected values (succeeds)

---

## SDK highlights
- AES‑256‑GCM encryption helpers
- Commitment hash = `sha256(nonce || payload)`
- Manual account decoding (skip discriminator, parse u64 LE, policy)
- `assertState` + `setPolicy` helpers
- WebSocket subscription helper

---

## Why indexers can’t see your data
Indexers only see:
- Account authority
- Commitment hash
- Nonce increments
- Policy byte

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
programs/pst_consumer/src/lib.rs
sdk/index.ts
scripts/init.ts
scripts/inc.ts
scripts/watch.ts
scripts/observer.ts
scripts/consumer_demo.ts
scripts/fs_atomic.ts
README.md
```

---

## Hackathon pitch (one‑liner)
**PST makes private state easy on Solana: verifiable updates on‑chain, encrypted data off‑chain, zero zk complexity, and composable CPI validation.**
