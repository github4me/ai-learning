"""Week 6: a full process using the same data entry later consumed by MiniGPT."""
import torch
from course_data import DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, make_windows, configure_console


class BigramLanguageModel(torch.nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.logits_table = torch.nn.Embedding(vocab_size, vocab_size)
        # Matches the zero-score, one-step calculation in Week 6 §14.
        with torch.no_grad():
            self.logits_table.weight.zero_()

    def forward(self, ids, targets=None):
        logits = self.logits_table(ids)
        loss = None if targets is None else torch.nn.functional.cross_entropy(
            logits.reshape(-1, logits.size(-1)), targets.reshape(-1))
        return logits, loss


def main():
    configure_console()
    torch.set_num_threads(1)
    torch.manual_seed(7)
    x, y = make_windows(DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, 2)
    inputs, targets = torch.tensor(x), torch.tensor(y)
    model = BigramLanguageModel(5)
    optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
    for step in range(1, 501):
        optimizer.zero_grad(set_to_none=True)
        _, loss = model(inputs, targets)
        loss.backward()
        if step == 1:
            print("six input/target questions:", inputs, targets)
            print("before update loss:", loss.item())
            print("gradient of the 我 row:", model.logits_table.weight.grad[0])
        optimizer.step()
        if step == 1:
            print("updated 我 row:", model.logits_table.weight[0].detach())
        if step in (1, 100, 500):
            with torch.no_grad():
                _, after = model(inputs, targets)
            print("completed_updates,loss_after_update:", step, after.item())
    history = torch.tensor([[0]], dtype=torch.long)
    with torch.no_grad():
        for _ in range(6):
            logits, _ = model(history)
            probabilities = logits[:, -1].softmax(dim=-1)
            next_id = torch.multinomial(probabilities, 1)
            history = torch.cat((history, next_id), dim=1)
    print("sample:", FIVE_WORD_TOKENIZER.decode(history[0].tolist()))
    print("Bigram sees only the current token. Repeated labels do not imply zero achievable loss.")


if __name__ == "__main__":
    main()
