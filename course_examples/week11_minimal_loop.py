# 在 course_examples 目录运行：python week11_minimal_loop.py
import torch
from mini_gpt_walkthrough import GPTConfig, MiniGPT
from course_data import DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, make_windows, configure_console

configure_console()
torch.set_num_threads(1)
torch.manual_seed(7)
x, y = make_windows(DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, block_size=2)
inputs = torch.tensor(x, dtype=torch.long)
targets = torch.tensor(y, dtype=torch.long)
model = MiniGPT(GPTConfig())
optimizer = torch.optim.AdamW(model.parameters(), lr=0.001, weight_decay=0.01)

for step in range(1, 101):
    model.train()
    optimizer.zero_grad(set_to_none=True)
    logits, loss = model(inputs, targets)
    if loss is None or not torch.isfinite(loss):
        raise ValueError("Non-finite loss; no parameter update performed")
    loss.backward()
    optimizer.step()
    if step == 1 or step % 20 == 0:
        print("completed_update=", step, "loss_before_this_update=", loss.item())

model.eval()
with torch.no_grad():
    _, final_loss = model(inputs, targets)
print("same_batch_loss_after_100_updates=", final_loss.item())
print("这是三句固定数据的流程演示，不是独立验证或泛化证明。")
