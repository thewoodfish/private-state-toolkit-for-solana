# Private State Toolkit - Demo Video Script

**Duration:** 3-5 minutes
**Purpose:** Show PST's core features and value proposition for hackathon judges

---

## 1. Opening (30 seconds)

**Visual:** Show project title and GitHub repo

**Script:**
> "Hi! I'm presenting Private State Toolkit - privacy infrastructure for Solana that enables private but verifiable state without zero-knowledge proofs."
>
> "Many apps need data privacy AND integrity guarantees. PST solves this by storing only cryptographic commitments on-chain while keeping encrypted data off-chain."

---

## 2. The Problem (30 seconds)

**Visual:** Show bullet points

**Script:**
> "Think about these use cases:"
> - "Games need hidden player state"
> - "Identity systems need private attestations"
> - "Apps need confidential configurations"
>
> "But on Solana, all state is public by default. ZK solutions exist but they're complex and expensive. We need something simpler."

---

## 3. How PST Works (60 seconds)

**Visual:** Show architecture diagram or code

**Script:**
> "Here's how PST works:"
>
> "Step 1: Your app encrypts state locally using AES-256"
> - Show: `{"counter": 5}` → encrypted blob
>
> "Step 2: Compute a SHA-256 commitment"
> - Show: `commitment = sha256(nonce || encrypted_data)`
>
> "Step 3: Store ONLY the commitment on-chain"
> - Show on-chain account: authority, commitment, nonce, policy
>
> "That's it! Only 81 bytes on-chain. No one can see your data without the encryption key, but everyone can verify updates are legitimate."

---

## 4. Demo Part 1: Private Counter (90 seconds)

**Visual:** Terminal split screen showing init, watch, and increment

**Script:**
> "Let me show you a private counter demo."
>
> "First, I'll initialize a PST account with a counter starting at 0."
> - Run: `npx ts-node scripts/init.ts`
> - Show: Initial commitment created
>
> "Now I'll start a watcher with the encryption key."
> - Run: `npx ts-node scripts/watch.ts`
> - Show: Counter value displayed as 0
>
> "In another terminal, I'll increment the counter."
> - Run: `npx ts-node scripts/inc.ts` (multiple times)
> - Show: Watcher updates showing counter: 1, 2, 3...
>
> "Notice the on-chain account only stores a hash - but the watcher with the key can decrypt the real value."
>
> "Now let me start an observer WITHOUT the decryption key."
> - Run: `npx ts-node scripts/observer.ts`
> - Show: Observer sees commitment changes but not the actual counter value
>
> "This proves integrity is public, but data stays private."

---

## 5. Demo Part 2: Update Policies (30 seconds)

**Visual:** Show policy configuration

**Script:**
> "PST supports two update policies:"
>
> "StrictSequential - nonce must increment by exactly 1. Perfect for turn-based games."
>
> "AllowSkips - nonce just needs to increase. Great for offline or batched updates."
>
> "You can even change policies at runtime!"

---

## 6. Demo Part 3: CPI Composability (60 seconds)

**Visual:** Show consumer demo code and terminal

**Script:**
> "The killer feature is CPI composability. Other programs can validate private state without decryption."
>
> "Here's a consumer program that gates actions on PST state freshness."
> - Show `assert_state` CPI code
>
> "Let me run the full demo."
> - Run: `npx ts-node scripts/consumer_demo.ts`
> - Show: Consumer validates PST commitment before executing
>
> "This means ANY Solana program can build on PST. It's truly composable infrastructure."

---

## 7. Technical Highlights (30 seconds)

**Visual:** Show README or code snippets

**Script:**
> "Key technical features:"
> - "Only 81 bytes per account on-chain"
> - "AES-256-GCM encryption client-side"
> - "SHA-256 commitments for integrity"
> - "Two-phase local sync protocol handles WebSocket lag"
> - "Deterministic CPI validation"
> - "No ZK circuits, no complex math - just hashes and encryption"

---

## 8. Use Cases (20 seconds)

**Visual:** Show bullet points

**Script:**
> "This enables:"
> - "Games with hidden state"
> - "Private identity attestations"
> - "Confidential app configurations"
> - "Any scenario needing integrity without public data"

---

## 9. Closing (20 seconds)

**Visual:** Show GitHub repo and final slide

**Script:**
> "Private State Toolkit makes private state easy on Solana: verifiable on-chain, encrypted off-chain, zero ZK complexity, and fully composable."
>
> "Check out the code on GitHub. Thanks for watching!"

---

## Recording Tips

1. **Preparation:**
   - Clean terminal environment
   - Test all commands beforehand
   - Have demo accounts funded
   - Clear any old state files

2. **Visual Setup:**
   - Use large terminal font (16-18pt)
   - Split screen for simultaneous views
   - Screen recording at 1080p minimum
   - Consider adding captions

3. **Pacing:**
   - Speak clearly and not too fast
   - Pause 2 seconds after each command output
   - Let viewers read important text
   - Keep energy up!

4. **Technical Checks:**
   - Ensure `state/` directory is clean before starting
   - Have devnet connection stable
   - Run through entire script once before recording

5. **Backup Plan:**
   - Record terminal session separately from voiceover
   - Can add voiceover in post-production if needed
   - Keep raw footage in case edits are needed

---

## Quick Recording Checklist

- [ ] Clean workspace (rm -rf state/ demo-key.json)
- [ ] Devnet funded accounts
- [ ] All scripts tested
- [ ] Terminal font size increased
- [ ] Screen recorder ready
- [ ] Microphone tested
- [ ] Script reviewed
- [ ] GitHub repo URL ready to show
- [ ] Final slide prepared

---

## Alternative: Silent Demo with Text Overlays

If you prefer not to do voiceover, you can create a silent demo with text overlays explaining each step. Use video editing software to add:

- Title cards between sections
- Text annotations explaining what's happening
- Arrows or highlights on important terminal output
- Background music (optional, keep it subtle)

This can be just as effective and easier to edit!
