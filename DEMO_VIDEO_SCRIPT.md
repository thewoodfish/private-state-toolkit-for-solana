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

---

## COMPLETE RECORDING SCRIPT (Read Verbatim)

**Total Duration: 3-4 minutes**

---

Hi! I'm presenting Private State Toolkit - privacy infrastructure for Solana that enables private but verifiable state without zero-knowledge proofs.

Many apps need data privacy AND integrity guarantees. PST solves this by storing only cryptographic commitments on-chain while keeping encrypted data off-chain.

The problem: Games need hidden player state, identity systems need private attestations, apps need confidential configurations. But on Solana, all state is public by default. Zero-knowledge solutions exist, but they're complex and expensive. We need something simpler.

Here's how PST works. Your app encrypts state locally using AES-256. We compute a SHA-256 commitment of the encrypted data. Then we store ONLY that commitment on-chain - just 81 bytes containing the authority, commitment hash, nonce, and policy. No one can see your data without the encryption key, but everyone can verify updates are legitimate.

Let me show you this with a private counter demo. I'm initializing a PST account with a counter starting at zero. Done - commitment created on-chain.

Now I'll start a watcher that has the encryption key. It shows counter: 0.

In another terminal, I'm incrementing the counter. Watch the watcher update - counter: 1, 2, 3. The on-chain account only stores a hash, but the watcher with the key sees the real value.

Now let me start an observer WITHOUT the decryption key. It sees the commitment changing but cannot decrypt the actual value. Integrity is public, but data stays private.

PST supports two update policies: StrictSequential for turn-based games where nonce must increment by one, and AllowSkips for offline scenarios where nonce just needs to increase.

Here's the killer feature - CPI composability. Other Solana programs can validate private state without decrypting it. I've built a consumer program that gates actions based on PST state freshness.

Running the consumer demo now - it successfully validates the PST commitment before executing. This means ANY Solana program can build on PST. It's truly composable infrastructure.

Key technical features: Only 81 bytes on-chain, AES-256-GCM encryption, SHA-256 commitments, two-phase sync protocol for WebSocket lag, and deterministic CPI validation. No ZK circuits, no complex math - just hashes and encryption.

This enables games with hidden state, private identity attestations, confidential app configurations, and any scenario needing integrity without public data.

Private State Toolkit makes private state easy on Solana - verifiable on-chain, encrypted off-chain, zero ZK complexity, and fully composable.

Check out the code on GitHub. Thanks for watching!

---

## DETAILED VISUAL GUIDE (Shot-by-Shot)

### SETUP BEFORE RECORDING:
```bash
# Clean workspace
rm -rf state/
rm -f demo-key.json

# Ensure devnet funded
# Have 3 terminal windows ready:
#   Terminal 1: For init and increment commands
#   Terminal 2: For watcher
#   Terminal 3: For observer and consumer demo
```

---

### SHOT 1: Opening (0:00-0:15)
**Audio:** "Hi! I'm presenting Private State Toolkit - privacy infrastructure for Solana..."

**Visual:**
- Show title slide or GitHub repo page
- Display: "Private State Toolkit for Solana"
- Show the README.md file or repo URL clearly
- Optional: Your face/camera if doing talking head

**Screen:** GitHub repo at https://github.com/[your-username]/private-state-toolkit-for-solana

---

### SHOT 2: Problem Statement (0:15-0:30)
**Audio:** "The problem: Games need hidden player state, identity systems need private attestations..."

**Visual:**
- Show bullet points on screen:
  ```
  THE PROBLEM:
  • Games need hidden player state
  • Identity systems need private attestations
  • Apps need confidential configurations

  BUT: All Solana state is PUBLIC
  ZK solutions are COMPLEX & EXPENSIVE
  ```

**Screen:** Slide or text editor with these points

---

### SHOT 3: How PST Works (0:30-0:55)
**Audio:** "Here's how PST works. Your app encrypts state locally..."

**Visual:**
- Show architecture diagram OR
- Show code/text visualization:
  ```
  Step 1: Encrypt locally
  {"counter": 5} → [encrypted blob]

  Step 2: Compute commitment
  commitment = sha256(nonce || encrypted_data)

  Step 3: Store on-chain (81 bytes)
  ┌─────────────────────────┐
  │ authority              │
  │ commitment (32 bytes)  │
  │ nonce                  │
  │ policy                 │
  └─────────────────────────┘
  ```

**Screen:** Draw.io diagram or text visualization in terminal/editor

---

### SHOT 4: Demo Init (0:55-1:05)
**Audio:** "Let me show you this with a private counter demo. I'm initializing a PST account..."

**Visual - Terminal 1:**
```bash
# Show this command being typed and executed
npx ts-node scripts/init.ts
```

**Screen capture:**
- Show the terminal output
- Highlight the generated keypair
- Highlight "State commitment created" message
- Show the commitment hash that appears

**Wait 2 seconds on the output**

---

### SHOT 5: Start Watcher (1:05-1:15)
**Audio:** "Now I'll start a watcher that has the encryption key. It shows counter: 0."

**Visual - Terminal 2 (split screen or switch):**
```bash
# Show this command being executed
npx ts-node scripts/watch.ts
```

**Screen capture:**
- Show watcher starting up
- Highlight output showing: "Counter: 0" or similar
- Keep this terminal visible in corner of screen for next shots

**Arrangement:** Split screen with Terminal 1 on left, Terminal 2 (watcher) on right

---

### SHOT 6: Increment Counter (1:15-1:30)
**Audio:** "In another terminal, I'm incrementing the counter. Watch the watcher update - counter: 1, 2, 3..."

**Visual - Split screen:**
- **Left (Terminal 1):** Run increment commands
  ```bash
  npx ts-node scripts/inc.ts
  # Wait 2 seconds, run again
  npx ts-node scripts/inc.ts
  # Wait 2 seconds, run again
  npx ts-node scripts/inc.ts
  ```

- **Right (Terminal 2 - watcher):** Keep watcher visible
  - Show it updating to Counter: 1
  - Then Counter: 2
  - Then Counter: 3

**Screen capture:**
- Use split screen so viewer sees both simultaneously
- Maybe add arrow or highlight when watcher updates

**Timing:** Run increment every 3-4 seconds so viewer can see updates

---

### SHOT 7: Observer Without Key (1:30-1:45)
**Audio:** "Now let me start an observer WITHOUT the decryption key. It sees the commitment changing but cannot decrypt..."

**Visual - Terminal 3:**
```bash
# Show this command being executed
npx ts-node scripts/observer.ts
```

**Screen capture:**
- Show observer output
- Highlight that it shows commitment hashes changing
- Highlight that it does NOT show actual counter values
- Maybe show side-by-side with watcher to contrast

**Split screen arrangement:**
- Left: Observer (sees only commitments)
- Right: Watcher (sees actual values)

**Annotation:** Add text overlay: "Observer: Sees commitments ✓" vs "Watcher: Sees values ✓"

---

### SHOT 8: Update Policies (1:45-1:55)
**Audio:** "PST supports two update policies: StrictSequential for turn-based games..."

**Visual:**
- Show code snippet or text:
  ```
  UPDATE POLICIES:

  StrictSequential
  └─ Nonce must increment by exactly 1
  └─ Perfect for turn-based games

  AllowSkips
  └─ Nonce just needs to increase
  └─ Great for offline scenarios
  ```

**Screen:** Show this in README.md or in programs/pst/src/lib.rs around the UpdatePolicy enum

---

### SHOT 9: CPI Composability Intro (1:55-2:05)
**Audio:** "Here's the killer feature - CPI composability. Other Solana programs can validate private state..."

**Visual:**
- Show consumer program code
- Navigate to: `programs/consumer/src/lib.rs`
- Scroll to the `assert_state` function
- Highlight the CPI call:
  ```rust
  pst::cpi::assert_state(cpi_ctx, expected_commitment, expected_nonce)?;
  ```

**Screen:** VSCode or editor showing the consumer program CPI code

---

### SHOT 10: Consumer Demo (2:05-2:20)
**Audio:** "Running the consumer demo now - it successfully validates the PST commitment before executing..."

**Visual - Terminal 1 or 3:**
```bash
# Show this command being executed
npx ts-node scripts/consumer_demo.ts
```

**Screen capture:**
- Show the consumer demo output
- Highlight successful validation messages
- Show "Consumer program executed successfully" or similar
- Maybe highlight the transaction signature

**Wait 2-3 seconds on success output**

---

### SHOT 11: Technical Highlights (2:20-2:40)
**Audio:** "Key technical features: Only 81 bytes on-chain, AES-256-GCM encryption..."

**Visual:**
- Show code or text summary:
  ```
  TECHNICAL FEATURES:
  ✓ 81 bytes on-chain per account
  ✓ AES-256-GCM encryption
  ✓ SHA-256 commitments
  ✓ 2-phase sync protocol
  ✓ Deterministic CPI validation
  ✓ No ZK circuits - just hashes & encryption
  ```

**Screen options:**
1. Show the PstAccount struct in `programs/pst/src/lib.rs`
2. Show README technical section
3. Show slide with these bullet points

---

### SHOT 12: Use Cases (2:40-2:50)
**Audio:** "This enables games with hidden state, private identity attestations..."

**Visual:**
- Show bullet points:
  ```
  USE CASES:
  🎮 Games with hidden state
  🆔 Private identity attestations
  ⚙️  Confidential app configurations
  🔒 Any scenario needing integrity without public data
  ```

**Screen:** Slide or README use cases section

---

### SHOT 13: Closing (2:50-3:05)
**Audio:** "Private State Toolkit makes private state easy on Solana - verifiable on-chain, encrypted off-chain..."

**Visual:**
- Show summary slide:
  ```
  Private State Toolkit

  ✓ Verifiable on-chain
  ✓ Encrypted off-chain
  ✓ Zero ZK complexity
  ✓ Fully composable
  ```

**Screen:** Title slide with these points

---

### SHOT 14: Final Call to Action (3:05-3:10)
**Audio:** "Check out the code on GitHub. Thanks for watching!"

**Visual:**
- Show GitHub repo page
- Display URL clearly on screen
- Optional: Show star count, README preview
- End with clean title screen

**Screen:** GitHub repo with URL visible, maybe add text overlay with the URL

---

## EDITING CHECKLIST:

- [ ] Sync audio with each visual section above
- [ ] Add text overlays for key points (optional but helpful)
- [ ] Ensure terminal font is large (16-18pt minimum)
- [ ] Add arrows/highlights on important output (optional)
- [ ] Fade or transition between major sections
- [ ] Ensure GitHub URL is clearly visible at end
- [ ] Add captions if needed for accessibility
- [ ] Keep video at 1080p minimum resolution

---

## PRO TIPS:

1. **For terminal recordings:** Use `asciinema` or record with OBS at high resolution
2. **Split screens:** Use OBS or video editor to show multiple terminals simultaneously
3. **Highlights:** Add subtle zoom or highlight boxes in post on important output
4. **Pacing:** Leave 1-2 second pauses between shots for viewer comprehension
5. **Text overlays:** Add section titles ("Demo", "Technical Features", etc.) as lower thirds
6. **Background:** Consider subtle background music at low volume (optional)
