"""Week 11 完整函数。Import 不训练、不生成、不保存文件。"""


# week11_training_and_generation.py
# This Week 11 caller imports the frozen Week 10 implementation.
import math

import torch
import torch.nn.functional as F

from mini_gpt_walkthrough import (
    GPTConfig,
    MiniGPT,
    load_mini_gpt_for_inference,
    save_mini_gpt_training_checkpoint,
    validate_checkpoint_tokenizer_identity,
)


CANONICAL_ORDERED_TOKENS = ("我", "喜欢", "AI", "学习", "猫")
CANONICAL_TOKENIZER_POLICY = (
    "whitespace-delimited;no-specials;no-pad;no-unk"
)
CANONICAL_TOKENIZER_VERSION = "mini-gpt-v1"


def train_mini_gpt_step(
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    device: torch.device,
    max_grad_norm: float = 1.0,
    completed_updates: int = 0,
) -> tuple[torch.Tensor, torch.Tensor, int]:
    if not math.isfinite(max_grad_norm) or max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be positive")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )

    model.train()
    inputs = inputs.to(device)
    targets = targets.to(device)
    optimizer.zero_grad(set_to_none=True)
    logits, loss = model(inputs, targets)
    assert logits.shape == (*inputs.shape, model.config.vocab_size)
    assert loss is not None
    if not torch.isfinite(loss):
        raise ValueError("训练 loss 非有限，停止本次更新")
    loss.backward()
    grad_norm = torch.nn.utils.clip_grad_norm_(
        model.parameters(),
        max_norm=max_grad_norm,
        error_if_nonfinite=True,
    )
    optimizer.step()
    completed_updates += 1  # only after optimizer.step succeeds
    return loss.detach(), grad_norm.detach(), completed_updates


def train_mini_gpt_epoch(
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
    train_batches,
    device: torch.device,
    accumulation_steps: int = 1,
    completed_updates: int = 0,
) -> tuple[int, float]:
    if type(accumulation_steps) is not int or accumulation_steps < 1:
        raise ValueError("accumulation_steps must be a positive integer")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )

    # Validate all batches before touching model mode, gradients, or optimizer.
    batches = list(train_batches)
    if not batches:
        raise ValueError("train_batches must not be empty")
    if len(batches) % accumulation_steps != 0:
        raise ValueError(
            "train_batches must form complete accumulation windows"
        )

    reference_shape = None
    reference_target_count = None
    for batch_number, batch in enumerate(batches, start=1):
        if not isinstance(batch, (tuple, list)) or len(batch) != 2:
            raise TypeError(f"batch {batch_number} must be (inputs, targets)")
        inputs, targets = batch
        if not isinstance(inputs, torch.Tensor) or not isinstance(
            targets,
            torch.Tensor,
        ):
            raise TypeError(f"batch {batch_number} values must be tensors")
        if inputs.ndim != 2 or targets.shape != inputs.shape:
            raise ValueError(
                f"batch {batch_number} inputs/targets must share [B,T]"
            )
        if inputs.dtype != torch.long or targets.dtype != torch.long:
            raise TypeError(
                f"batch {batch_number} inputs/targets must be torch.long"
            )
        target_count = targets.numel()
        if target_count <= 0:
            raise ValueError(f"batch {batch_number} has no target tokens")
        if not 1 <= inputs.size(1) <= model.config.block_size:
            raise ValueError(f"batch {batch_number} has invalid T")
        for name, token_ids in (("inputs", inputs), ("targets", targets)):
            if (
                int(token_ids.min().item()) < 0
                or int(token_ids.max().item()) >= model.config.vocab_size
            ):
                raise ValueError(
                    f"batch {batch_number} {name} IDs are outside vocabulary"
                )

        if reference_shape is None:
            reference_shape = inputs.shape
            reference_target_count = target_count
        elif (
            inputs.shape != reference_shape
            or target_count != reference_target_count
        ):
            raise ValueError(
                "this teaching helper requires equal-token microbatches"
            )

    model.train()
    optimizer.zero_grad(set_to_none=True)
    detached_loss_sum = 0.0

    for window_start in range(0, len(batches), accumulation_steps):
        window = batches[
            window_start : window_start + accumulation_steps
        ]
        for inputs, targets in window:
            inputs = inputs.to(device)
            targets = targets.to(device)
            logits, loss = model(inputs, targets)
            assert logits.shape[-1] == model.config.vocab_size
            assert loss is not None
            (loss / accumulation_steps).backward()
            detached_loss_sum += loss.detach().item()

        torch.nn.utils.clip_grad_norm_(
            model.parameters(),
            max_norm=1.0,
        )
        optimizer.step()
        completed_updates += 1  # only after optimizer.step succeeds
        optimizer.zero_grad(set_to_none=True)

    mean_microbatch_loss = detached_loss_sum / len(batches)
    return completed_updates, mean_microbatch_loss


def evaluate_mini_gpt_loss(
    model: MiniGPT,
    validation_batches,
    device: torch.device,
    ignore_index: int = -100,
) -> float:
    if 0 <= ignore_index < model.config.vocab_size:
        raise ValueError("ignore_index must not be a vocabulary ID")

    was_training = model.training
    batch_count = 0
    valid_target_count = 0
    loss_sum = 0.0
    model.eval()
    try:
        with torch.no_grad():
            for inputs, targets in validation_batches:
                batch_count += 1
                if targets.shape != inputs.shape:
                    raise ValueError("targets must match inputs shape")
                if targets.dtype != torch.long:
                    raise TypeError("targets must have dtype torch.long")

                inputs = inputs.to(device)
                targets = targets.to(device)
                valid_mask = targets.ne(ignore_index)
                batch_valid_count = int(valid_mask.sum().item())
                if batch_valid_count == 0:
                    continue

                valid_targets = targets[valid_mask]
                if (
                    int(valid_targets.min().item()) < 0
                    or int(valid_targets.max().item())
                    >= model.config.vocab_size
                ):
                    raise ValueError("valid target IDs are outside vocabulary")

                # Do not pass -100 targets into canonical MiniGPT.forward.
                logits, no_loss = model(inputs)
                assert no_loss is None
                batch_loss_sum = F.cross_entropy(
                    logits.reshape(-1, model.config.vocab_size),
                    targets.reshape(-1),
                    ignore_index=ignore_index,
                    reduction="sum",
                )
                loss_sum += batch_loss_sum.item()
                valid_target_count += batch_valid_count
    finally:
        model.train(was_training)

    if batch_count == 0:
        raise ValueError("validation_batches must not be empty")
    if valid_target_count == 0:
        raise ValueError("validation has no valid target tokens")
    return loss_sum / valid_target_count


def backward_and_clip_mini_gpt(
    model: MiniGPT,
    loss: torch.Tensor,
    max_grad_norm: float = 1.0,
) -> torch.Tensor:
    if loss.ndim != 0:
        raise ValueError("loss must be a scalar tensor")
    if not math.isfinite(max_grad_norm) or max_grad_norm <= 0:
        raise ValueError("max_grad_norm must be finite and positive")

    loss.backward()
    grad_norm = torch.nn.utils.clip_grad_norm_(
        model.parameters(),
        max_norm=max_grad_norm,
    )
    return grad_norm.detach()


# Caller order inside one update window:
# optimizer.zero_grad(...) -> forward creates loss -> helper above
# -> optimizer.step() -> increment completed_updates


def overfit_mini_gpt_one_batch(
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    device: torch.device,
    updates: int = 200,
    completed_updates: int = 0,
) -> tuple[list[float], int]:
    if type(updates) is not int or updates < 1:
        raise ValueError("updates must be a positive integer")
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )

    model.train()
    inputs = inputs.to(device)
    targets = targets.to(device)
    history: list[float] = []
    for _ in range(updates):
        optimizer.zero_grad(set_to_none=True)
        logits, loss = model(inputs, targets)
        assert logits.shape == (3, 2, 5)
        assert loss is not None and torch.isfinite(loss)
        loss.backward()
        optimizer.step()
        completed_updates += 1  # only after optimizer.step succeeds
        history.append(loss.detach().item())
    return history, completed_updates


def validate_mini_gpt_adamw_model_binding(
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
) -> list[torch.nn.Parameter]:
    if type(model) is not MiniGPT:
        raise TypeError("faithful training requires exactly MiniGPT")
    if type(optimizer) is not torch.optim.AdamW:
        raise TypeError("faithful training requires exactly torch.optim.AdamW")

    model_parameters = list(model.parameters())
    if not model_parameters:
        raise ValueError("MiniGPT must have parameters")
    if len(optimizer.param_groups) != 1:
        raise ValueError("AdamW must have exactly one canonical param group")

    live_group = optimizer.param_groups[0]
    live_parameters = live_group.get("params")
    if not isinstance(live_parameters, list):
        raise ValueError("AdamW live params must be a list")
    if len(live_parameters) != len(model_parameters):
        raise ValueError("AdamW must own every MiniGPT parameter exactly once")
    if any(
        actual is not expected
        for actual, expected in zip(live_parameters, model_parameters)
    ):
        raise ValueError("AdamW parameters must match MiniGPT identity and order")
    return model_parameters


def validate_mini_gpt_adamw_state_dict(
    model: MiniGPT,
    optimizer_state: object,
    completed_updates: int,
) -> None:
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    if not isinstance(optimizer_state, dict):
        raise ValueError("AdamW state_dict must be a dictionary")
    if set(optimizer_state) != {"state", "param_groups"}:
        raise ValueError("AdamW state_dict keys mismatch")

    state = optimizer_state["state"]
    param_groups = optimizer_state["param_groups"]
    if not isinstance(state, dict) or not isinstance(param_groups, list):
        raise ValueError("malformed AdamW state_dict")
    if len(param_groups) != 1 or not isinstance(param_groups[0], dict):
        raise ValueError("serialized AdamW must have one canonical param group")

    model_parameters = list(model.parameters())
    expected_ids = list(range(len(model_parameters)))
    stored_ids = param_groups[0].get("params")
    if not isinstance(stored_ids, list) or not all(
        type(parameter_id) is int for parameter_id in stored_ids
    ):
        raise ValueError("serialized AdamW parameter IDs must be integers")
    if stored_ids != expected_ids:
        raise ValueError("serialized AdamW parameter IDs/order are not canonical")

    # AdamW creates per-parameter state lazily on its first successful step.
    if completed_updates == 0:
        if state:
            raise ValueError("zero completed updates require empty AdamW state")
        return

    if not all(type(parameter_id) is int for parameter_id in state):
        raise ValueError("AdamW state keys must be integer parameter IDs")
    if set(state) != set(expected_ids):
        raise ValueError("nonzero progress requires state for every parameter")

    amsgrad = param_groups[0].get("amsgrad")
    if type(amsgrad) is not bool:
        raise ValueError("AdamW amsgrad metadata must be boolean")
    expected_state_keys = {"step", "exp_avg", "exp_avg_sq"}
    if amsgrad:
        expected_state_keys.add("max_exp_avg_sq")

    for parameter_id, parameter in enumerate(model_parameters):
        parameter_state = state[parameter_id]
        if not isinstance(parameter_state, dict):
            raise ValueError("each AdamW parameter state must be a dictionary")
        if set(parameter_state) != expected_state_keys:
            raise ValueError("AdamW per-parameter state keys mismatch")

        raw_step = parameter_state["step"]
        if torch.is_tensor(raw_step):
            if raw_step.numel() != 1:
                raise ValueError("AdamW step must be scalar")
            raw_step = raw_step.detach().cpu().item()
        if isinstance(raw_step, bool) or not isinstance(raw_step, (int, float)):
            raise ValueError("AdamW step must be a finite integer")
        numeric_step = float(raw_step)
        if not math.isfinite(numeric_step) or not numeric_step.is_integer():
            raise ValueError("AdamW step must be a finite integer")
        if int(numeric_step) != completed_updates:
            raise ValueError("completed_updates disagrees with AdamW step state")

        moment_names = ["exp_avg", "exp_avg_sq"]
        if amsgrad:
            moment_names.append("max_exp_avg_sq")
        for moment_name in moment_names:
            moment = parameter_state[moment_name]
            if not torch.is_tensor(moment) or moment.shape != parameter.shape:
                raise ValueError(
                    f"AdamW {moment_name} shape mismatches parameter order"
                )


def validate_mini_gpt_adamw_completed_updates(
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
    completed_updates: int,
) -> None:
    validate_mini_gpt_adamw_model_binding(model, optimizer)
    validate_mini_gpt_adamw_state_dict(
        model,
        optimizer.state_dict(),
        completed_updates,
    )


def train_and_save_week11_one_batch(
    path: str,
    *,
    model: MiniGPT,
    optimizer: torch.optim.AdamW,
    inputs: torch.Tensor,
    targets: torch.Tensor,
    device: torch.device,
    requested_updates: int = 200,
    completed_updates: int = 0,
) -> tuple[list[float], int]:
    # Check resume progress before training, then derive new progress from
    # successful optimizer.step calls rather than from requested_updates.
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )
    history, completed_updates = overfit_mini_gpt_one_batch(
        model,
        optimizer,
        inputs,
        targets,
        device,
        updates=requested_updates,
        completed_updates=completed_updates,
    )
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )

    # Save through the canonical Week 10 API; do not invent new keys.
    save_mini_gpt_training_checkpoint(
        path,
        model=model,
        optimizer=optimizer,
        completed_updates=completed_updates,
        ordered_tokens=CANONICAL_ORDERED_TOKENS,
        tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        tokenizer_version=CANONICAL_TOKENIZER_VERSION,
    )
    return history, completed_updates


def week11_config_fields(config: GPTConfig) -> dict[str, int]:
    return {
        "vocab_size": config.vocab_size,
        "block_size": config.block_size,
        "n_embd": config.n_embd,
        "n_head": config.n_head,
        "n_layer": config.n_layer,
    }


def load_mini_gpt_training_resume(
    path: str,
    *,
    device: torch.device,
) -> tuple[MiniGPT, torch.optim.AdamW, int]:
    checkpoint = torch.load(
        path,
        map_location=device,
        weights_only=False,
    )
    if not isinstance(checkpoint, dict):
        raise ValueError("checkpoint must be a dictionary")
    required_keys = {
        "schema",
        "tokenizer",
        "config",
        "weight_policy",
        "model_state",
        "optimizer",
        "completed_updates",
    }
    if set(checkpoint) != required_keys:
        raise ValueError("training checkpoint keys mismatch")
    if checkpoint["schema"] != {
        "name": "mini-gpt-training-checkpoint",
        "version": 1,
    }:
        raise ValueError("checkpoint schema/version mismatch")

    validate_checkpoint_tokenizer_identity(
        checkpoint,
        expected_ordered_tokens=CANONICAL_ORDERED_TOKENS,
        expected_tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        expected_tokenizer_version=CANONICAL_TOKENIZER_VERSION,
    )
    expected_config = GPTConfig()
    if checkpoint["config"] != week11_config_fields(expected_config):
        raise ValueError("checkpoint config mismatch")
    if checkpoint["weight_policy"] != {
        "token_embedding_lm_head": "untied",
    }:
        raise ValueError("checkpoint weight policy mismatch")

    completed_updates = checkpoint["completed_updates"]
    if type(completed_updates) is not int or completed_updates < 0:
        raise ValueError("completed_updates must be a non-negative integer")
    optimizer_payload = checkpoint["optimizer"]
    if not isinstance(optimizer_payload, dict):
        raise ValueError("optimizer checkpoint must be a dictionary")
    if set(optimizer_payload) != {"class", "state"}:
        raise ValueError("optimizer checkpoint keys mismatch")
    expected_optimizer_class = (
        f"{torch.optim.AdamW.__module__}."
        f"{torch.optim.AdamW.__qualname__}"
    )
    if optimizer_payload["class"] != expected_optimizer_class:
        raise ValueError("optimizer class mismatch")
    serialized_optimizer_state = optimizer_payload["state"]
    if not isinstance(serialized_optimizer_state, dict):
        raise ValueError("optimizer state must be a dictionary")

    # Construct and use state only after every identity check above passes.
    model = MiniGPT(expected_config).to(device)
    model.load_state_dict(checkpoint["model_state"], strict=True)
    if model.lm_head.weight is model.token_embedding.weight:
        raise ValueError("restored model must keep canonical untied weights")
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-3,
        weight_decay=1e-2,
    )
    validate_mini_gpt_adamw_model_binding(model, optimizer)
    validate_mini_gpt_adamw_state_dict(
        model,
        serialized_optimizer_state,
        completed_updates,
    )
    optimizer.load_state_dict(serialized_optimizer_state)
    validate_mini_gpt_adamw_completed_updates(
        model,
        optimizer,
        completed_updates,
    )
    return model, optimizer, completed_updates


def load_week11_mini_gpt_for_inference(
    path: str,
    *,
    device: torch.device,
) -> MiniGPT:
    # Inference-only restore delegates to the frozen Week 10 loader.
    inference_model = load_mini_gpt_for_inference(
        path,
        expected_ordered_tokens=CANONICAL_ORDERED_TOKENS,
        expected_tokenizer_policy=CANONICAL_TOKENIZER_POLICY,
        expected_tokenizer_version=CANONICAL_TOKENIZER_VERSION,
        map_location=device,
    )
    inference_model.eval()
    return inference_model


def sample_mini_gpt_next_id(
    last_logits: torch.Tensor,
    temperature: float = 1.0,
    top_k: int | None = None,
) -> torch.Tensor:
    if not isinstance(last_logits, torch.Tensor):
        raise TypeError("last_logits must be a tensor")
    if last_logits.ndim != 2:
        raise ValueError("last_logits must have shape [B,V]")
    if last_logits.size(0) < 1:
        raise ValueError("last_logits must contain at least one batch row")
    if last_logits.size(-1) != 5:
        raise ValueError("mini-gpt-v1 requires V=5")
    if not torch.is_floating_point(last_logits):
        raise TypeError("last_logits must use a floating dtype")
    if not bool(torch.isfinite(last_logits).all()):
        raise ValueError("last_logits must be finite")
    if type(temperature) not in (int, float):
        raise TypeError("temperature must be a real number")
    temperature = float(temperature)
    if not math.isfinite(temperature) or temperature <= 0:
        raise ValueError("temperature must be positive")

    vocabulary_size = last_logits.size(-1)
    if top_k is not None:
        if type(top_k) is not int or not 1 <= top_k <= vocabulary_size:
            raise ValueError("top_k must be an integer in [1,V]")

    # Softmax support and numeric headroom are safer than half precision.
    working_dtype = (
        torch.float64
        if last_logits.dtype == torch.float64
        else torch.float32
    )
    sampling_logits = last_logits.to(dtype=working_dtype)
    dtype_limits = torch.finfo(working_dtype)
    if temperature < dtype_limits.tiny:
        raise ValueError("temperature is too small for the sampling dtype")
    if temperature > dtype_limits.max:
        raise ValueError("temperature is too large for the sampling dtype")

    row_max = sampling_logits.amax(dim=-1, keepdim=True)
    centered_logits = sampling_logits - row_max
    if not bool(torch.isfinite(centered_logits).all()):
        raise ValueError("last_logits range is too wide after centering")

    scaled_logits = centered_logits / temperature
    if not bool(torch.isfinite(scaled_logits).all()):
        raise ValueError(
            "temperature is too small for this logit range and sampling dtype"
        )

    # Top-k stays after temperature scaling and before Softmax.
    filtered_logits = scaled_logits
    if top_k is not None:
        top_values, top_indices = torch.topk(
            scaled_logits,
            k=top_k,
            dim=-1,
        )
        filtered_logits = torch.full_like(
            scaled_logits,
            float("-inf"),
        )
        filtered_logits.scatter_(
            dim=-1,
            index=top_indices,
            src=top_values,
        )

    probabilities = F.softmax(filtered_logits, dim=-1)
    probability_sums = probabilities.sum(dim=-1)
    if (
        not bool(torch.isfinite(probabilities).all())
        or bool((probabilities < 0).any())
        or not bool(torch.isfinite(probability_sums).all())
        or bool((probability_sums <= 0).any())
    ):
        raise ValueError("temperature/top_k produced unusable probabilities")

    next_id = torch.multinomial(probabilities, num_samples=1)
    assert next_id.dtype == torch.long
    return next_id  # [B,1]


@torch.no_grad()
def generate_mini_gpt_sampled(
    model: MiniGPT,
    history: torch.Tensor,
    max_new_tokens: int,
    temperature: float = 1.0,
    top_k: int | None = None,
) -> torch.Tensor:
    if type(max_new_tokens) is not int or max_new_tokens < 0:
        raise ValueError("max_new_tokens must be a non-negative integer")
    if history.ndim != 2:
        raise ValueError("history must have shape [B,L_history]")
    if history.dtype != torch.long:
        raise TypeError("history must have dtype torch.long")
    if history.numel() == 0 or history.size(1) < 1:
        raise ValueError("history must contain at least one token per row")
    if int(history.min().item()) < 0 or int(history.max().item()) >= 5:
        raise ValueError("history IDs must be in [0,4]")
    if history.device != next(model.parameters()).device:
        raise ValueError("history and model must be on the same device")
    if not math.isfinite(temperature) or temperature <= 0:
        raise ValueError("temperature must be positive")
    if top_k is not None:
        if type(top_k) is not int or not 1 <= top_k <= 5:
            raise ValueError("top_k must be an integer in [1,5]")

    was_training = model.training
    model.eval()
    try:
        for _ in range(max_new_tokens):
            context = history[:, -model.config.block_size :]
            logits, no_loss = model(context)  # no targets in generation
            assert no_loss is None
            last_logits = logits[:, -1, :]
            next_id = sample_mini_gpt_next_id(
                last_logits,
                temperature=temperature,
                top_k=top_k,
            )
            assert next_id.shape == (history.size(0), 1)
            history = torch.cat((history, next_id), dim=1)
    finally:
        model.train(was_training)
    return history
