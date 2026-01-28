//! # PST Consumer Demo Program
//!
//! This program demonstrates **CPI composability** with Private State Toolkit (PST).
//! It shows how any Solana program can gate actions on private state without
//! decrypting or seeing the plaintext data.
//!
//! ## What This Proves
//!
//! 1. **Cross-Program Validation**: Programs can verify PST commitments via CPI
//! 2. **Zero Knowledge Required**: Consumer doesn't need encryption key
//! 3. **Composability**: PST is truly reusable infrastructure
//!
//! ## Example Flow
//!
//! 1. User creates a PST private state account
//! 2. User creates a consumer account linked to that PST account
//! 3. User calls `gated_action` with expected commitment/nonce
//! 4. Consumer validates via CPI to PST's `assert_state`
//! 5. If valid, consumer increments its counter
//!
//! This pattern enables:
//! - Gated access based on private credentials
//! - Actions that require proof of private state freshness
//! - Multi-program workflows with private data

use anchor_lang::prelude::*;

declare_id!("BxqCdUzNrMifua7Rd3qQSqgd4oyTzdcTqH1tbYuvi5bf");

#[program]
pub mod pst_consumer {
    use super::*;

    /// Initializes a consumer account linked to a PST private state.
    ///
    /// # Arguments
    ///
    /// * `private_state` - The PST account this consumer will validate against
    ///
    /// # Purpose
    ///
    /// Creates the link between this consumer program and a specific PST account.
    /// Future `gated_action` calls will validate against this PST account.
    pub fn initialize_consumer(
        ctx: Context<InitializeConsumer>,
        private_state: Pubkey,
    ) -> Result<()> {
        let account = &mut ctx.accounts.consumer;
        account.count = 0;
        account.private_state = private_state;
        Ok(())
    }

    /// Performs an action gated on PST state validation.
    ///
    /// This is the key demo: an action that requires proof of private state
    /// without this program ever seeing the encrypted data.
    ///
    /// # Arguments
    ///
    /// * `expected_commitment` - The commitment we expect PST to have
    /// * `expected_nonce` - The nonce we expect PST to have
    ///
    /// # Validation Flow
    ///
    /// 1. Verify private_state matches consumer's linked PST account
    /// 2. **CPI to PST**: Call `assert_state` on PST program
    /// 3. PST validates commitment and nonce match on-chain state
    /// 4. If CPI succeeds, we know state is valid → execute gated action
    /// 5. Increment consumer's counter
    ///
    /// # CPI Security
    ///
    /// The CPI ensures the consumer cannot fake the validation:
    /// - PST program checks its own on-chain state
    /// - Consumer must provide correct values
    /// - If PST fails, entire transaction reverts
    pub fn gated_action(
        ctx: Context<GatedAction>,
        expected_commitment: [u8; 32],
        expected_nonce: u64,
    ) -> Result<()> {
        // Ensure the private_state account matches what this consumer expects
        require!(
            ctx.accounts.consumer.private_state == ctx.accounts.private_state.key(),
            ConsumerError::InvalidPrivateState
        );

        // Prepare CPI accounts for PST's assert_state instruction
        let cpi_program = ctx.accounts.pst_program.to_account_info();
        let cpi_accounts = private_state_toolkit::cpi::accounts::AssertState {
            private_state: ctx.accounts.private_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // Call PST's assert_state via CPI
        // This validates the commitment and nonce without decryption
        private_state_toolkit::cpi::assert_state(
            cpi_ctx,
            expected_commitment,
            expected_nonce,
        )?;

        // If we reach here, PST validation succeeded
        // Now execute the gated action: increment counter
        let account = &mut ctx.accounts.consumer;
        account.count = account.count.saturating_add(1);
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

/// Consumer account that tracks gated actions.
///
/// **Total size: 48 bytes** (8-byte discriminator + 40 bytes data)
#[account]
pub struct ConsumerAccount {
    /// Number of successful gated_action calls (8 bytes)
    /// Increments each time PST validation succeeds
    pub count: u64,

    /// The PST private state account this consumer validates against (32 bytes)
    pub private_state: Pubkey,
}

// ============================================================================
// Instruction Contexts
// ============================================================================

/// Accounts for the initialize_consumer instruction.
#[derive(Accounts)]
pub struct InitializeConsumer<'info> {
    /// The consumer account to create
    /// Space: 8 (discriminator) + 8 (count) + 32 (private_state)
    #[account(init, payer = authority, space = 8 + 8 + 32)]
    pub consumer: Account<'info, ConsumerAccount>,

    /// The authority creating this account (pays rent)
    #[account(mut)]
    pub authority: Signer<'info>,

    /// System program for account creation
    pub system_program: Program<'info, System>,
}

/// Accounts for the gated_action instruction.
#[derive(Accounts)]
pub struct GatedAction<'info> {
    /// The consumer account (increments on success)
    #[account(mut)]
    pub consumer: Account<'info, ConsumerAccount>,

    /// The PST private state account to validate
    /// CHECK: Validated by PST program via CPI (not by us)
    /// We pass this to PST's assert_state, which checks its validity
    pub private_state: AccountInfo<'info>,

    /// The PST program (for CPI)
    pub pst_program: Program<'info, private_state_toolkit::program::PrivateStateToolkit>,

    /// The signer (required for transaction)
    pub authority: Signer<'info>,
}

// ============================================================================
// Errors
// ============================================================================

/// Custom errors for consumer operations.
#[error_code]
pub enum ConsumerError {
    /// Thrown when private_state account doesn't match consumer's linked PST account.
    #[msg("Consumer account does not match the expected private state.")]
    InvalidPrivateState,
}
