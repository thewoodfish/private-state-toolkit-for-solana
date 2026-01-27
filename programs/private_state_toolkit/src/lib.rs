use anchor_lang::prelude::*;

declare_id!("4FeUYtneSbfieLwjUT1ceHtv8nDXFk2autCZFyDhpkeD");

#[program]
pub mod private_state_toolkit {
    use super::*;

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

    pub fn update(
        ctx: Context<Update>,
        old_commitment: [u8; 32],
        new_commitment: [u8; 32],
        next_nonce: u64,
    ) -> Result<()> {
        let state = &mut ctx.accounts.private_state;

        require!(
            state.commitment == old_commitment,
            PrivateStateError::CommitmentMismatch
        );
        match UpdatePolicy::try_from(state.policy)? {
            UpdatePolicy::StrictSequential => {
                require!(
                    next_nonce == state.nonce.saturating_add(1),
                    PrivateStateError::NonceNotSequential
                );
            }
            UpdatePolicy::AllowSkips => {
                require!(
                    next_nonce > state.nonce,
                    PrivateStateError::NonceNotMonotonic
                );
            }
        }

        state.commitment = new_commitment;
        state.nonce = next_nonce;

        log_commitment(state.nonce, &state.commitment, state.policy);
        Ok(())
    }

    pub fn transfer_authority(
        ctx: Context<TransferAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let state = &mut ctx.accounts.private_state;
        state.authority = new_authority;
        Ok(())
    }

    pub fn set_policy(ctx: Context<SetPolicy>, policy: u8) -> Result<()> {
        validate_policy(policy)?;
        let state = &mut ctx.accounts.private_state;
        let old_policy = state.policy;
        state.policy = policy;
        msg!("policy: {} -> {}", old_policy, policy);
        Ok(())
    }

    pub fn assert_state(
        ctx: Context<AssertState>,
        expected_commitment: [u8; 32],
        expected_nonce: u64,
    ) -> Result<()> {
        let state = &ctx.accounts.private_state;
        require!(
            state.commitment == expected_commitment,
            PrivateStateError::CommitmentMismatch
        );
        require!(
            state.nonce == expected_nonce,
            PrivateStateError::NonceMismatch
        );
        log_commitment(state.nonce, &state.commitment, state.policy);
        Ok(())
    }
}

#[account]
pub struct PrivateState {
    pub authority: Pubkey,
    pub commitment: [u8; 32],
    pub nonce: u64,
    pub policy: u8,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 32 + 8 + 1)]
    pub private_state: Account<'info, PrivateState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut, has_one = authority)]
    pub private_state: Account<'info, PrivateState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
    #[account(mut, has_one = authority)]
    pub private_state: Account<'info, PrivateState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetPolicy<'info> {
    #[account(mut, has_one = authority)]
    pub private_state: Account<'info, PrivateState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AssertState<'info> {
    pub private_state: Account<'info, PrivateState>,
}

#[derive(Clone, Copy)]
pub enum UpdatePolicy {
    StrictSequential,
    AllowSkips,
}

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

#[error_code]
pub enum PrivateStateError {
    #[msg("Stored commitment does not match the provided old commitment.")]
    CommitmentMismatch,
    #[msg("Nonce does not match expected value.")]
    NonceMismatch,
    #[msg("Nonce must increment exactly by one.")]
    NonceNotSequential,
    #[msg("Nonce must be strictly greater than the stored nonce.")]
    NonceNotMonotonic,
    #[msg("Invalid policy; expected 0 (StrictSequential) or 1 (AllowSkips).")]
    InvalidPolicy,
}

fn validate_policy(policy: u8) -> Result<()> {
    match policy {
        0 | 1 => Ok(()),
        _ => Err(PrivateStateError::InvalidPolicy.into()),
    }
}

fn log_commitment(nonce: u64, commitment: &[u8; 32], policy: u8) {
    let prefix = to_hex(&commitment[0..6]);
    msg!(
        "nonce: {}, commitment_prefix: {}, policy: {}",
        nonce,
        prefix,
        policy
    );
}

fn to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(nibble_to_hex(b >> 4));
        out.push(nibble_to_hex(b & 0x0f));
    }
    out
}

fn nibble_to_hex(nibble: u8) -> char {
    match nibble {
        0..=9 => (b'0' + nibble) as char,
        10..=15 => (b'a' + (nibble - 10)) as char,
        _ => '?',
    }
}
