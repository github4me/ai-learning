# Twelve-week continuous learning route

Follow the current website's reading order. Original section IDs are retained for
links, not as an instruction to jump repeatedly between old numbers. Break each
unit into manageable sessions: predict, calculate or run, then explain.

| Week | Learning sequence | Independent outcome / where to revisit |
|---|---|---|
| 1 | Inputs and rules → dot product and bias → batches and outputs | Obtain [1.4,1.1] and explain every X/W/b/Z axis. A valid shape does not prove valid feature meaning. |
| 2 | Prediction and loss → small changes → partial derivatives → repeated updates | Explain L(1)=9, forward difference ≈−11.996, batch dw=−35 and db=−12. Revisit parameter perturbations if the update direction is unclear. |
| 3 | One neuron → ReLU and XOR → two-layer calculation → task-specific output | Preserve the negative output −1.4 and count nine parameters. |
| 4 | Dependencies and old values → path gradients → branches → simultaneous update | Derive −12/−6 and explain why updating w2 early invalidates the hidden-layer gradient. |
| 5 | Tensor interfaces → Autograd → step state → Module and diagnosis | Match three implementations with equal initialization/reduction/lr. An old loss value does not refresh after step(). |
| 6 | Tokens and batches → representations and scores → loss and Bigram → generation | Relate h, logits, probabilities, targets and gradients. The same distribution can incur different losses for different targets. |
| 7 | Context-dependent reading → scores and weighted values → causality → CE and update | Distinguish Softmax over positions from Softmax over vocabulary candidates; explain the gradient reaching Wq. |
| 8 | Position → FFN/residuals → LayerNorm/Pre-Norm → output head | Trace both identity paths. Use the Week 7 bridge before the separate fixed two-head calculation. |
| 9 | Fixed encoding → documents/windows → independent splits → tokenizer comparisons | Explain T+1, unknown tokens and document boundaries. Byte/BPE/special-token examples are separate artifacts. |
| 10 | Embedding-only → single/multi/block → axes and parameters → full model | Run all five stages. Equal output shapes do not mean equal computations. |
| 11 | Update/AdamW → evaluation → saving → generation | Separate parameters, gradients, m/v and temporary activations; aggregate evaluation by effective targets. |
| 12 | A: trace → B: independent documents → C: change one factor → limitations | Present real logs. Toy loss reduction is not language competence; inference reload is not exact training replay. |

## Connected examples

Weeks 1–5 move from a specified multiply-and-add rule to automatic differentiation
and parameter updates. Keep each experiment's initialization and expected values together.

Weeks 6–12 use the fixed five-word tokenizer and three sentences in
`course_data.py` to explain mechanisms. Week 7/8 projections for hand calculation
are explicitly supplied, not claimed to be the output of earlier training.

Week 12 Project B starts a separate data experiment: an independently fixed
character alphabet and original documents, the same MiniGPT class, but a new
configuration and checkpoint format.

## Keep a four-line learning record

1. What do I predict will change when I modify this input or parameter?
2. What numbers did I actually calculate or observe?
3. Why do they differ? Did I mix data, shapes, parameters or averaging rules?
4. Which single change would distinguish two competing explanations?

Not every experiment must improve loss. A negative result is useful when its
conditions and measurements are honest. Knowing terminology is not a substitute
for completing a calculation.
