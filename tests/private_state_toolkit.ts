import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PrivateStateToolkit } from "../target/types/private_state_toolkit";
import { expect } from "chai";
import { createHash } from "crypto";

describe("private_state_toolkit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.PrivateStateToolkit as Program<PrivateStateToolkit>;

  let privateStateKeypair: anchor.web3.Keypair;
  let authority: anchor.web3.Keypair;

  beforeEach(() => {
    privateStateKeypair = anchor.web3.Keypair.generate();
    authority = anchor.web3.Keypair.generate();
  });

  it("Initializes a private state account", async () => {
    // Airdrop to authority
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initialCommitment = Buffer.from(createHash("sha256").update("test").digest());
    const policy = 0; // StrictSequential

    await program.methods
      .initialize(Array.from(initialCommitment), policy)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([privateStateKeypair, authority])
      .rpc();

    const account = await program.account.privateState.fetch(
      privateStateKeypair.publicKey
    );

    expect(account.authority.toString()).to.equal(authority.publicKey.toString());
    expect(Buffer.from(account.commitment).equals(initialCommitment)).to.be.true;
    expect(account.nonce.toNumber()).to.equal(0);
    expect(account.policy).to.equal(policy);
  });

  it("Updates state with valid commitment", async () => {
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initialCommitment = Buffer.from(createHash("sha256").update("test1").digest());
    const newCommitment = Buffer.from(createHash("sha256").update("test2").digest());
    const policy = 0;

    await program.methods
      .initialize(Array.from(initialCommitment), policy)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([privateStateKeypair, authority])
      .rpc();

    await program.methods
      .update(
        Array.from(initialCommitment),
        Array.from(newCommitment),
        new anchor.BN(1)
      )
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const account = await program.account.privateState.fetch(
      privateStateKeypair.publicKey
    );

    expect(Buffer.from(account.commitment).equals(newCommitment)).to.be.true;
    expect(account.nonce.toNumber()).to.equal(1);
  });

  it("Fails to update with wrong commitment", async () => {
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initialCommitment = Buffer.from(createHash("sha256").update("test1").digest());
    const wrongCommitment = Buffer.from(createHash("sha256").update("wrong").digest());
    const newCommitment = Buffer.from(createHash("sha256").update("test2").digest());
    const policy = 0;

    await program.methods
      .initialize(Array.from(initialCommitment), policy)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([privateStateKeypair, authority])
      .rpc();

    try {
      await program.methods
        .update(
          Array.from(wrongCommitment),
          Array.from(newCommitment),
          new anchor.BN(1)
        )
        .accounts({
          privateState: privateStateKeypair.publicKey,
          authority: authority.publicKey,
        })
        .signers([authority])
        .rpc();

      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error.toString()).to.include("CommitmentMismatch");
    }
  });

  it("Transfers authority", async () => {
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initialCommitment = Buffer.from(createHash("sha256").update("test").digest());
    const newAuthority = anchor.web3.Keypair.generate();
    const policy = 0;

    await program.methods
      .initialize(Array.from(initialCommitment), policy)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([privateStateKeypair, authority])
      .rpc();

    await program.methods
      .transferAuthority(newAuthority.publicKey)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const account = await program.account.privateState.fetch(
      privateStateKeypair.publicKey
    );

    expect(account.authority.toString()).to.equal(newAuthority.publicKey.toString());
  });

  it("Allows skips with AllowSkips policy", async () => {
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initialCommitment = Buffer.from(createHash("sha256").update("test1").digest());
    const newCommitment = Buffer.from(createHash("sha256").update("test2").digest());
    const policy = 1; // AllowSkips

    await program.methods
      .initialize(Array.from(initialCommitment), policy)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([privateStateKeypair, authority])
      .rpc();

    // Skip from nonce 0 to nonce 5
    await program.methods
      .update(
        Array.from(initialCommitment),
        Array.from(newCommitment),
        new anchor.BN(5)
      )
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
      })
      .signers([authority])
      .rpc();

    const account = await program.account.privateState.fetch(
      privateStateKeypair.publicKey
    );

    expect(account.nonce.toNumber()).to.equal(5);
  });

  it("Assert state validates commitment and nonce", async () => {
    await provider.connection.requestAirdrop(
      authority.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await new Promise(resolve => setTimeout(resolve, 1000));

    const initialCommitment = Buffer.from(createHash("sha256").update("test").digest());
    const policy = 0;

    await program.methods
      .initialize(Array.from(initialCommitment), policy)
      .accounts({
        privateState: privateStateKeypair.publicKey,
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([privateStateKeypair, authority])
      .rpc();

    // Should succeed with correct values
    await program.methods
      .assertState(Array.from(initialCommitment), new anchor.BN(0))
      .accounts({
        privateState: privateStateKeypair.publicKey,
      })
      .rpc();

    // Should fail with wrong commitment
    const wrongCommitment = Buffer.from(createHash("sha256").update("wrong").digest());
    try {
      await program.methods
        .assertState(Array.from(wrongCommitment), new anchor.BN(0))
        .accounts({
          privateState: privateStateKeypair.publicKey,
        })
        .rpc();

      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error.toString()).to.include("CommitmentMismatch");
    }
  });
});
