use anchor_lang::prelude::*;

declare_id!("4FeUYtneSbfieLwjUT1ceHtv8nDXFk2autCZFyDhpkeD");

#[program]
pub mod private_state_toolkit {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_commitment: [u8; 32]) -> Result<()> {
        let state = &mut ctx.accounts.private_state;
        state.authority = ctx.accounts.authority.key();
        state.commitment = initial_commitment;
        state.nonce = 0;

        log_commitment(state.nonce, &state.commitment);
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
        require!(
            next_nonce == state.nonce.saturating_add(1),
            PrivateStateError::InvalidNonce
        );

        state.commitment = new_commitment;
        state.nonce = next_nonce;

        log_commitment(state.nonce, &state.commitment);
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
}

#[account]
pub struct PrivateState {
    pub authority: Pubkey,
    pub commitment: [u8; 32],
    pub nonce: u64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 32 + 8)]
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

#[error_code]
pub enum PrivateStateError {
    #[msg("Stored commitment does not match the provided old commitment.")]
    CommitmentMismatch,
    #[msg("Nonce must increment exactly by one.")]
    InvalidNonce,
}

fn log_commitment(nonce: u64, commitment: &[u8; 32]) {
    let prefix = to_hex(&commitment[0..6]);
    msg!("nonce: {}, commitment_prefix: {}", nonce, prefix);
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
