use anchor_lang::prelude::*;

declare_id!("BxqCdUzNrMifua7Rd3qQSqgd4oyTzdcTqH1tbYuvi5bf");

#[program]
pub mod pst_consumer {
    use super::*;

    pub fn initialize_consumer(
        ctx: Context<InitializeConsumer>,
        private_state: Pubkey,
    ) -> Result<()> {
        let account = &mut ctx.accounts.consumer;
        account.count = 0;
        account.private_state = private_state;
        Ok(())
    }

    pub fn gated_action(
        ctx: Context<GatedAction>,
        expected_commitment: [u8; 32],
        expected_nonce: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.consumer.private_state == ctx.accounts.private_state.key(),
            ConsumerError::InvalidPrivateState
        );
        let cpi_program = ctx.accounts.pst_program.to_account_info();
        let cpi_accounts = private_state_toolkit::cpi::accounts::AssertState {
            private_state: ctx.accounts.private_state.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        private_state_toolkit::cpi::assert_state(
            cpi_ctx,
            expected_commitment,
            expected_nonce,
        )?;

        let account = &mut ctx.accounts.consumer;
        account.count = account.count.saturating_add(1);
        Ok(())
    }
}

#[account]
pub struct ConsumerAccount {
    pub count: u64,
    pub private_state: Pubkey,
}

#[derive(Accounts)]
pub struct InitializeConsumer<'info> {
    #[account(init, payer = authority, space = 8 + 8 + 32)]
    pub consumer: Account<'info, ConsumerAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GatedAction<'info> {
    #[account(mut)]
    pub consumer: Account<'info, ConsumerAccount>,
    /// CHECK: validated by PST CPI
    pub private_state: AccountInfo<'info>,
    pub pst_program: Program<'info, private_state_toolkit::program::PrivateStateToolkit>,
    pub authority: Signer<'info>,
}

#[error_code]
pub enum ConsumerError {
    #[msg("Consumer account does not match the expected private state.")]
    InvalidPrivateState,
}
