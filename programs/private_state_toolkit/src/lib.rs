//! # Private State Toolkit (PST)
//!
//! Privacy infrastructure for Solana programs that enables private but verifiable state
//! without zero-knowledge proofs. PST stores only cryptographic commitments on-chain while
//! keeping encrypted data off-chain.
//!
//! ## Core Concept
//!
//! Applications encrypt state locally (AES-256-GCM) and compute a commitment:
//! ```text
//! commitment = sha256(nonce || encrypted_payload)
//! ```
//!
//! On-chain accounts store only:
//! - authority (32 bytes)
//! - commitment (32 bytes)
//! - nonce (8 bytes)
//! - policy (1 byte)
//!
//! Total: 81 bytes per account
//!
//! ## Features
//!
//! - **CPI Composability**: Other programs can validate state via `assert_state`
//! - **Update Policies**: StrictSequential (turn-based) or AllowSkips (async/offline)
//! - **Authority Transfer**: Change account ownership
//! - **Policy Changes**: Runtime update policy modification

use anchor_lang::prelude::*;

declare_id!("4FeUYtneSbfieLwjUT1ceHtv8nDXFk2autCZFyDhpkeD");

#[program]
pub mod private_state_toolkit {
    use super::*;

    /// Initializes a new private state account with an initial commitment.
    ///
    /// # Arguments
    ///
    /// * `initial_commitment` - SHA-256 hash of (nonce || encrypted_payload)
    /// * `policy` - Update policy: 0 = StrictSequential, 1 = AllowSkips
    ///
    /// # Example Flow
    ///
    /// 1. Client encrypts state: `{"counter": 0}` → encrypted blob
    /// 2. Client computes: `commitment = sha256(0 || encrypted_blob)`
    /// 3. Client calls this instruction with commitment
    /// 4. On-chain account stores: authority, commitment, nonce=0, policy
    pub fn initialize(
        ctx: Context<Initialize>,
        initial_commitment: [u8; 32],
        policy: u8,
    ) -> Result<()> {
        validate_policy(policy)?;
        let state = &mut ctx.accounts.private_state;
        state.authority = ctx.accounts.authority.key();
        state.commitment = initial_commitment;
        state.nonce = 0;
        state.policy = policy;

        log_commitment(state.nonce, &state.commitment, state.policy);
        Ok(())
    }

    /// Updates the private state with a new commitment.
    ///
    /// This is the core update operation. It validates that:
    /// 1. The caller knows the current commitment (proves they have current state)
    /// 2. The nonce follows the policy rules (prevents replay attacks)
    ///
    /// # Arguments
    ///
    /// * `old_commitment` - Current commitment stored on-chain (must match)
    /// * `new_commitment` - New commitment to store
    /// * `next_nonce` - New nonce value (must satisfy policy)
    ///
    /// # Policy Validation
    ///
    /// - **StrictSequential**: `next_nonce` must equal `current_nonce + 1`
    /// - **AllowSkips**: `next_nonce` must be greater than `current_nonce`
    ///
    /// # Security
    ///
    /// The old_commitment check ensures only the entity with the encryption key
    /// (who can compute correct commitments) can update the state.
    pub fn update(
        ctx: Context<Update>,
        old_commitment: [u8; 32],
        new_commitment: [u8; 32],
        next_nonce: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.private_state;

        // Verify caller knows the current state by checking commitment
        require!(
            state.commitment == old_commitment,
            PrivateStateError::CommitmentMismatch
        );

        // Enforce nonce rules based on the account's policy
        match UpdatePolicy::try_from(state.policy)? {
            UpdatePolicy::StrictSequential => {
                // Turn-based: nonce must increment by exactly 1
                require!(
                    next_nonce == state.nonce.saturating_add(1),
                    PrivateStateError::NonceNotSequential
                );
            }
            UpdatePolicy::AllowSkips => {
                // Async-friendly: nonce just needs to increase
                require!(
                    next_nonce > state.nonce,
                    PrivateStateError::NonceNotMonotonic
                );
            }
        }

        // Update on-chain state
        state.commitment = new_commitment;
        state.nonce = next_nonce;

        log_commitment(state.nonce, &state.commitment, state.policy);
        Ok(())
    }

    /// Transfers authority of the private state account to a new owner.
    ///
    /// # Arguments
    ///
    /// * `new_authority` - Public key of the new authority
    ///
    /// # Use Cases
    ///
    /// - Transfer ownership between users
    /// - Upgrade to multi-sig authority
    /// - Transfer to a program-derived address (PDA)
    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let state = &mut ctx.accounts.private_state;
        state.authority = new_authority;
        Ok(())
    }

    /// Changes the update policy at runtime.
    ///
    /// # Arguments
    ///
    /// * `policy` - New policy: 0 = StrictSequential, 1 = AllowSkips
    ///
    /// # Use Cases
    ///
    /// - Switch from strict mode to allow offline updates
    /// - Tighten policy after initial flexible setup
    /// - Adapt to changing application requirements
    pub fn set_policy(ctx: Context<SetPolicy>, policy: u8) -> Result<()> {
        validate_policy(policy)?;
        let state = &mut ctx.accounts.private_state;
        let old_policy = state.policy;
        state.policy = policy;
        msg!("policy: {} -> {}", old_policy, policy);
        Ok(())
    }

    /// Validates that a private state account matches expected commitment and nonce.
    ///
    /// **This is the CPI composability hook.** Other programs can call this instruction
    /// via Cross-Program Invocation (CPI) to gate actions on private state freshness
    /// without needing the encryption key or seeing the plaintext.
    ///
    /// # Arguments
    ///
    /// * `expected_commitment` - The commitment value to check
    /// * `expected_nonce` - The nonce value to check
    ///
    /// # Design Properties
    ///
    /// - **Read-only**: Does not mutate state (cheap, safe for CPI)
    /// - **Deterministic**: Same inputs always produce same result
    /// - **No decryption**: Caller doesn't need encryption key
    ///
    /// # Example CPI Usage
    ///
    /// ```rust,ignore
    /// let cpi_ctx = CpiContext::new(pst_program, AssertState { private_state });
    /// private_state_toolkit::cpi::assert_state(cpi_ctx, commitment, nonce)?;
    /// // If we reach here, the state is valid - proceed with gated action
    /// ```
    pub fn assert_state(
        ctx: Context<AssertState>,
        expected_commitment: [u8; 32],
        expected_nonce: u64,
    ) -> Result<()> {
        let state = &ctx.accounts.private_state;

        // Verify commitment matches
        require!(
            state.commitment == expected_commitment,
            PrivateStateError::CommitmentMismatch
        );

        // Verify nonce matches
        require!(
            state.nonce == expected_nonce,
            PrivateStateError::NonceMismatch
        );

        log_commitment(state.nonce, &state.commitment, state.policy);
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

/// The on-chain private state account.
///
/// **Total size: 81 bytes** (8-byte discriminator + 73 bytes data)
///
/// This is the only data stored on-chain. The actual encrypted application
/// state lives off-chain with the client.
#[account]
pub struct PrivateState {
    /// Authority that can update this account (32 bytes)
    pub authority: Pubkey,

    /// SHA-256 commitment hash (32 bytes)
    /// Computed as: sha256(nonce || encrypted_payload)
    pub commitment: [u8; 32],

    /// Monotonically increasing nonce (8 bytes)
    /// Prevents replay attacks and ensures ordering
    pub nonce: u64,

    /// Update policy (1 byte)
    /// 0 = StrictSequential, 1 = AllowSkips
    pub policy: u8,
}

// ============================================================================
// Instruction Contexts
// ============================================================================

/// Accounts for the initialize instruction.
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The private state account to create
    /// Space: 8 (discriminator) + 32 (authority) + 32 (commitment) + 8 (nonce) + 1 (policy)
    #[account(init, payer = authority, space = 8 + 32 + 32 + 8 + 1)]
    pub private_state: Account<'info, PrivateState>,

    /// The authority who owns this account (pays for creation)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// System program for account creation
    pub system_program: Program<'info, System>,
}

/// Accounts for the update instruction.
#[derive(Accounts)]
pub struct Update<'info> {
    /// The private state account to update
    /// has_one = authority ensures only the authority can update
    #[account(mut, has_one = authority)]
    pub private_state: Account<'info, PrivateState>,

    /// The authority who owns this account
    pub authority: Signer<'info>,
}

/// Accounts for the transfer_authority instruction.
#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    /// The private state account whose authority is being transferred
    #[account(mut, has_one = authority)]
    pub private_state: Account<'info, PrivateState>,

    /// The current authority (must sign)
    pub authority: Signer<'info>,
}

/// Accounts for the set_policy instruction.
#[derive(Accounts)]
pub struct SetPolicy<'info> {
    /// The private state account whose policy is being changed
    #[account(mut, has_one = authority)]
    pub private_state: Account<'info, PrivateState>,

    /// The authority who owns this account
    pub authority: Signer<'info>,
}

/// Accounts for the assert_state instruction.
///
/// This context is intentionally minimal (read-only) to be CPI-friendly.
/// Other programs can validate state without needing to be the authority.
#[derive(Accounts)]
pub struct AssertState<'info> {
    /// The private state account to validate (read-only)
    pub private_state: Account<'info, PrivateState>,
}

// ============================================================================
// Types and Enums
// ============================================================================

/// Update policy for nonce validation.
///
/// This determines how strictly nonces must increment.
#[derive(Clone, Copy)]
pub enum UpdatePolicy {
    /// Nonce must increment by exactly 1 each update.
    ///
    /// Use for: Turn-based games, deterministic workflows, strict ordering
    StrictSequential,

    /// Nonce must increase but can skip values.
    ///
    /// Use for: Offline updates, batched operations, async workflows
    AllowSkips,
}

/// Convert u8 to UpdatePolicy enum.
impl TryFrom<u8> for UpdatePolicy {
    type Error = anchor_lang::error::Error;

    fn try_from(value: u8) -> std::result::Result<Self, anchor_lang::error::Error> {
        match value {
            0 => Ok(UpdatePolicy::StrictSequential),
            1 => Ok(UpdatePolicy::AllowSkips),
            _ => Err(PrivateStateError::InvalidPolicy.into()),
        }
    }
}

// ============================================================================
// Errors
// ============================================================================

/// Custom errors for PST operations.
#[error_code]
pub enum PrivateStateError {
    /// Thrown when update() receives wrong old_commitment.
    /// This means the caller doesn't have the current state.
    #[msg("Stored commitment does not match the provided old commitment.")]
    CommitmentMismatch,

    /// Thrown when assert_state() receives wrong nonce.
    #[msg("Nonce does not match expected value.")]
    NonceMismatch,

    /// Thrown in StrictSequential mode when nonce doesn't increment by 1.
    #[msg("Nonce must increment exactly by one.")]
    NonceNotSequential,

    /// Thrown in AllowSkips mode when nonce doesn't increase.
    #[msg("Nonce must be strictly greater than the stored nonce.")]
    NonceNotMonotonic,

    /// Thrown when policy value is not 0 or 1.
    #[msg("Invalid policy; expected 0 (StrictSequential) or 1 (AllowSkips).")]
    InvalidPolicy,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Validates that a policy value is valid (0 or 1).
fn validate_policy(policy: u8) -> Result<()> {
    match policy {
        0 | 1 => Ok(()),
        _ => Err(PrivateStateError::InvalidPolicy.into()),
    }
}

/// Logs the current state to program logs (visible in transaction logs).
///
/// Logs first 6 bytes of commitment as hex for debugging.
fn log_commitment(nonce: u64, commitment: &[u8; 32], policy: u8) {
    let prefix = to_hex(&commitment[0..6]);
    msg!(
        "nonce: {}, commitment_prefix: {}, policy: {}",
        nonce,
        prefix,
        policy
    );
}

/// Converts bytes to lowercase hex string.
fn to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(nibble_to_hex(b >> 4));
        out.push(nibble_to_hex(b & 0x0f));
    }
    out
}

/// Converts a 4-bit value (0-15) to a hex character.
fn nibble_to_hex(nibble: u8) -> char {
    match nibble {
        0..=9 => (b'0' + nibble) as char,
        10..=15 => (b'a' + (nibble - 10)) as char,
        _ => '?',
    }
}
