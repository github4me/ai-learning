"""Week 10: inspect precisely what each assembly stage adds; no training."""
import argparse
import math
import torch
from course_data import DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, make_windows
from mini_gpt_walkthrough import GPTConfig, MiniGPT, CausalSelfAttention, TransformerBlock


class SingleHead(torch.nn.Module):
    def __init__(self, width):
        super().__init__()
        self.query = torch.nn.Linear(width, width, bias=False)
        self.key = torch.nn.Linear(width, width, bias=False)
        self.value = torch.nn.Linear(width, width, bias=False)

    def forward(self, x):
        q, k, value = self.query(x), self.key(x), self.value(x)
        scores = q @ k.transpose(-2, -1) / math.sqrt(q.shape[-1])
        allowed = torch.ones(x.shape[1], x.shape[1], dtype=torch.bool, device=x.device).tril()
        return scores.masked_fill(~allowed, float("-inf")).softmax(dim=-1) @ value


class AssemblyStage(torch.nn.Module):
    def __init__(self, stage, config):
        super().__init__()
        self.token = torch.nn.Embedding(config.vocab_size, config.n_embd)
        self.position = torch.nn.Embedding(config.block_size, config.n_embd)
        if stage == "embedding":
            self.context = torch.nn.Identity()
        elif stage == "single":
            self.context = SingleHead(config.n_embd)
        elif stage == "multi":
            self.context = CausalSelfAttention(config)
        else:
            self.context = TransformerBlock(config)
        self.head = torch.nn.Linear(config.n_embd, config.vocab_size, bias=False)

    def forward(self, ids, targets):
        x = self.token(ids) + self.position(torch.arange(ids.shape[1], device=ids.device))
        logits = self.head(self.context(x))
        loss = torch.nn.functional.cross_entropy(logits.reshape(-1, logits.shape[-1]), targets.reshape(-1))
        return logits, loss


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("embedding", "single", "multi", "block", "full"), default="embedding")
    args = parser.parse_args()
    torch.manual_seed(7)
    config = GPTConfig()
    model = MiniGPT(config) if args.stage == "full" else AssemblyStage(args.stage, config)
    x, y = make_windows(DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, config.block_size)
    with torch.no_grad():
        logits, loss = model(torch.tensor(x), torch.tensor(y))
    print("stage:", args.stage, "logits:", tuple(logits.shape), "loss:", loss.item())
    print("parameters:", sum(parameter.numel() for parameter in model.parameters()))
    for name, parameter in model.named_parameters():
        print(name, tuple(parameter.shape))
    print("These are architecture observations, not a trained performance comparison.")


if __name__ == "__main__":
    main()
