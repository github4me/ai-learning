"""Week 10 完整定义。Import 不训练、不生成、不保存文件。"""


import hashlib
import json
from dataclasses import dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass(frozen=True)
class GPTConfig:
    vocab_size: int = 5
    block_size: int = 2
    n_embd: int = 4
    n_head: int = 2
    n_layer: int = 2

    def validate(self) -> None:
        if self.vocab_size <= 0:
            raise ValueError("vocab_size must be positive")
        if self.block_size <= 0:
            raise ValueError("block_size must be positive")
        if self.n_embd <= 0:
            raise ValueError("n_embd must be positive")
        if self.n_head <= 0:
            raise ValueError("n_head must be positive")
        if self.n_layer <= 0:
            raise ValueError("n_layer must be positive")
        if self.n_embd % self.n_head != 0:
            raise ValueError("n_embd must be divisible by n_head")


class CausalSelfAttention(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.n_head = config.n_head
        self.head_size = config.n_embd // config.n_head
        self.qkv = nn.Linear(
            config.n_embd,
            3 * config.n_embd,
            bias=False,
        )
        self.output_projection = nn.Linear(
            config.n_embd,
            config.n_embd,
        )
        mask = torch.tril(
            torch.ones(config.block_size, config.block_size)
        )
        self.register_buffer(
            "causal_mask",
            mask.view(1, 1, config.block_size, config.block_size),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, T, C = x.shape
        q, k, value_states = self.qkv(x).chunk(3, dim=-1)
        q = q.view(B, T, self.n_head, self.head_size).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_size).transpose(1, 2)
        value_states = value_states.view(
            B,
            T,
            self.n_head,
            self.head_size,
        ).transpose(1, 2)

        scores = (q @ k.transpose(-2, -1)) * (self.head_size ** -0.5)
        visible = self.causal_mask[:, :, :T, :T]
        scores = scores.masked_fill(visible == 0, float("-inf"))
        weights = F.softmax(scores, dim=-1)
        output = weights @ value_states
        output = output.transpose(1, 2).contiguous().view(B, T, C)
        return self.output_projection(output)


class FeedForward(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(config.n_embd, 4 * config.n_embd),
            nn.GELU(),
            nn.Linear(4 * config.n_embd, config.n_embd),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class TransformerBlock(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        self.ln1 = nn.LayerNorm(config.n_embd)
        self.attention = CausalSelfAttention(config)
        self.ln2 = nn.LayerNorm(config.n_embd)
        self.feed_forward = FeedForward(config)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = x + self.attention(self.ln1(x))
        x = x + self.feed_forward(self.ln2(x))
        return x


class MiniGPT(nn.Module):
    def __init__(self, config: GPTConfig) -> None:
        super().__init__()
        config.validate()
        self.config = config
        self.token_embedding = nn.Embedding(
            config.vocab_size,
            config.n_embd,
        )
        self.position_embedding = nn.Embedding(
            config.block_size,
            config.n_embd,
        )
        self.blocks = nn.ModuleList(
            [TransformerBlock(config) for _ in range(config.n_layer)]
        )
        self.final_norm = nn.LayerNorm(config.n_embd)
        self.lm_head = nn.Linear(
            config.n_embd,
            config.vocab_size,
            bias=False,
        )
        self.apply(self._init_weights)

    @staticmethod
    def _init_weights(module: nn.Module) -> None:
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
            if module.bias is not None:
                nn.init.zeros_(module.bias)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    @staticmethod
    def _validate_token_ids(
        token_ids: torch.Tensor,
        *,
        name: str,
        vocab_size: int,
    ) -> None:
        if token_ids.dtype != torch.long:
            raise TypeError(f"{name} must have dtype torch.long")
        if token_ids.numel() == 0:
            raise ValueError(f"{name} must contain at least one token ID")
        minimum_id = int(token_ids.min().item())
        maximum_id = int(token_ids.max().item())
        if minimum_id < 0 or maximum_id >= vocab_size:
            raise ValueError(
                f"{name} IDs must be in [0, {vocab_size - 1}]"
            )

    def forward(
        self,
        idx: torch.Tensor,
        targets: torch.Tensor | None = None,
    ) -> tuple[torch.Tensor, torch.Tensor | None]:
        if idx.ndim != 2:
            raise ValueError("idx must have rank 2 with shape [B,T]")
        if idx.dtype != torch.long:
            raise TypeError("idx must have dtype torch.long")

        B, T = idx.shape
        if T < 1 or T > self.config.block_size:
            raise ValueError(
                f"sequence length must be in [1, {self.config.block_size}]"
            )
        self._validate_token_ids(
            idx,
            name="idx",
            vocab_size=self.config.vocab_size,
        )

        if targets is not None:
            if targets.shape != idx.shape:
                raise ValueError("targets must have the same shape as idx")
            if targets.dtype != torch.long:
                raise TypeError("targets must have dtype torch.long")
            self._validate_token_ids(
                targets,
                name="targets",
                vocab_size=self.config.vocab_size,
            )

        positions = torch.arange(T, device=idx.device)  # [T]
        token_rows = self.token_embedding(idx)  # [B,T,C]
        position_rows = self.position_embedding(positions)  # [T,C]
        x = token_rows + position_rows  # broadcast to [B,T,C]
        for block in self.blocks:
            x = block(x)  # [B,T,C]
        x = self.final_norm(x)  # [B,T,C]
        logits = self.lm_head(x)  # [B,T,V]

        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.reshape(B * T, self.config.vocab_size),
                targets.reshape(B * T),
            )
        return logits, loss


def make_tokenizer_artifact(
    *,
    version: str,
    ordered_tokens: tuple[str, ...],
    policy: str,
) -> dict[str, object]:
    return {
        "version": version,
        "ordered_tokens": list(ordered_tokens),
        "policy": policy,
    }


def tokenizer_artifact_sha256(artifact: dict[str, object]) -> str:
    canonical_bytes = json.dumps(
        artifact,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical_bytes).hexdigest()


def canonical_mini_gpt_tokenizer_artifact() -> dict[str, object]:
    return make_tokenizer_artifact(
        version="mini-gpt-v1",
        ordered_tokens=("我", "喜欢", "AI", "学习", "猫"),
        policy="whitespace-delimited;no-specials;no-pad;no-unk",
    )


def validate_checkpoint_tokenizer_identity(
    checkpoint: dict[str, object],
    *,
    expected_ordered_tokens: tuple[str, ...],
    expected_tokenizer_policy: str,
    expected_tokenizer_version: str,
) -> None:
    stored_tokenizer = checkpoint.get("tokenizer")
    if not isinstance(stored_tokenizer, dict):
        raise ValueError("checkpoint tokenizer metadata is missing")
    required_keys = {"version", "ordered_tokens", "policy", "sha256"}
    if set(stored_tokenizer) != required_keys:
        raise ValueError("checkpoint tokenizer metadata has unexpected keys")

    stored_artifact = {
        "version": stored_tokenizer["version"],
        "ordered_tokens": stored_tokenizer["ordered_tokens"],
        "policy": stored_tokenizer["policy"],
    }
    stored_digest = stored_tokenizer["sha256"]
    if not isinstance(stored_digest, str):
        raise ValueError("checkpoint tokenizer SHA-256 must be text")
    try:
        recomputed_digest = tokenizer_artifact_sha256(stored_artifact)
    except (TypeError, ValueError) as error:
        raise ValueError(
            "checkpoint tokenizer artifact is not canonical JSON data"
        ) from error
    if recomputed_digest != stored_digest:
        raise ValueError("checkpoint tokenizer artifact failed SHA-256 check")

    expected_artifact = make_tokenizer_artifact(
        version=expected_tokenizer_version,
        ordered_tokens=expected_ordered_tokens,
        policy=expected_tokenizer_policy,
    )
    canonical_artifact = canonical_mini_gpt_tokenizer_artifact()
    if expected_artifact != canonical_artifact:
        raise ValueError("caller tokenizer identity is not mini-gpt-v1")
    expected_digest = tokenizer_artifact_sha256(expected_artifact)
    if stored_artifact != expected_artifact:
        raise ValueError("stored tokenizer artifact does not match caller")
    if stored_digest != expected_digest:
        raise ValueError("stored tokenizer digest does not match caller")


def save_mini_gpt_training_checkpoint(
    path: str,
    *,
    model: MiniGPT,
    optimizer: torch.optim.Optimizer,
    completed_updates: int,
    ordered_tokens: tuple[str, ...],
    tokenizer_policy: str,
    tokenizer_version: str,
) -> None:
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    tokenizer_artifact = make_tokenizer_artifact(
        version=tokenizer_version,
        ordered_tokens=ordered_tokens,
        policy=tokenizer_policy,
    )
    if tokenizer_artifact != canonical_mini_gpt_tokenizer_artifact():
        raise ValueError("tokenizer artifact does not match mini-gpt-v1")
    tokenizer_digest = tokenizer_artifact_sha256(tokenizer_artifact)
    if model.config != GPTConfig():
        raise ValueError("model config is not the canonical GPTConfig")
    if model.lm_head.weight is model.token_embedding.weight:
        raise ValueError("canonical checkpoint requires untied weights")

    checkpoint = {
        "schema": {
            "name": "mini-gpt-training-checkpoint",
            "version": 1,
        },
        "tokenizer": {
            **tokenizer_artifact,
            "sha256": tokenizer_digest,
        },
        "config": {
            "vocab_size": model.config.vocab_size,
            "block_size": model.config.block_size,
            "n_embd": model.config.n_embd,
            "n_head": model.config.n_head,
            "n_layer": model.config.n_layer,
        },
        "weight_policy": {
            "token_embedding_lm_head": "untied",
        },
        "model_state": model.state_dict(),
        "optimizer": {
            "class": (
                f"{optimizer.__class__.__module__}."
                f"{optimizer.__class__.__qualname__}"
            ),
            "state": optimizer.state_dict(),
        },
        "completed_updates": completed_updates,
    }
    torch.save(checkpoint, path)


def load_mini_gpt_for_inference(
    path: str,
    *,
    expected_ordered_tokens: tuple[str, ...],
    expected_tokenizer_policy: str,
    expected_tokenizer_version: str,
    map_location: str | torch.device,
) -> MiniGPT:
    checkpoint = torch.load(
        path,
        map_location=map_location,
        weights_only=False,
    )
    if not isinstance(checkpoint, dict):
        raise ValueError("checkpoint must be a dictionary")
    if checkpoint.get("schema") != {
        "name": "mini-gpt-training-checkpoint",
        "version": 1,
    }:
        raise ValueError("checkpoint schema/version mismatch")

    validate_checkpoint_tokenizer_identity(
        checkpoint,
        expected_ordered_tokens=expected_ordered_tokens,
        expected_tokenizer_policy=expected_tokenizer_policy,
        expected_tokenizer_version=expected_tokenizer_version,
    )

    expected_config = GPTConfig()
    expected_config_fields = {
        "vocab_size": expected_config.vocab_size,
        "block_size": expected_config.block_size,
        "n_embd": expected_config.n_embd,
        "n_head": expected_config.n_head,
        "n_layer": expected_config.n_layer,
    }
    if checkpoint.get("config") != expected_config_fields:
        raise ValueError("checkpoint config mismatch")
    if checkpoint.get("weight_policy") != {
        "token_embedding_lm_head": "untied",
    }:
        raise ValueError("checkpoint weight policy mismatch")

    model = MiniGPT(expected_config).to(map_location)
    model.load_state_dict(checkpoint["model_state"], strict=True)
    return model


def main() -> None:
    torch.set_num_threads(1)
    torch.manual_seed(7)
    model = MiniGPT(GPTConfig()).eval()
    idx = torch.tensor([[0, 1], [4, 1]], dtype=torch.long)
    targets = torch.tensor([[1, 2], [1, 0]], dtype=torch.long)
    with torch.no_grad():
        logits, loss = model(idx, targets)
        changed_future, _ = model(torch.tensor([[0, 1], [0, 4]]))
    assert logits.shape == (2, 2, 5)
    assert loss is not None and loss.ndim == 0
    assert sum(p.numel() for p in model.parameters()) == 520
    torch.testing.assert_close(changed_future[0, 0], changed_future[1, 0])
    print("parameters=520; logits=(2,2,5); causal_check=PASS; loss=", loss.item())


if __name__ == "__main__":
    main()
