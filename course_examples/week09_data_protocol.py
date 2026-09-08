"""Week 9: same IDs and windows as Week 6, now inspect the data protocol."""
from course_data import DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, make_windows, configure_console


def main():
    configure_console()
    for text in DEMO_DOCUMENTS:
        ids = FIVE_WORD_TOKENIZER.encode(text)
        print(repr(text), ids, FIVE_WORD_TOKENIZER.decode(ids))
    x, y = make_windows(DEMO_DOCUMENTS, FIVE_WORD_TOKENIZER, block_size=2)
    print("inputs", x, "targets", y)
    for row, (inputs, targets) in enumerate(zip(x, y)):
        for position in range(2):
            print("row,position,visible,target:", row, position,
                  FIVE_WORD_TOKENIZER.decode(inputs[:position + 1]),
                  FIVE_WORD_TOKENIZER.decode([targets[position]]))
    try:
        FIVE_WORD_TOKENIZER.encode("我 喜欢 狗")
    except ValueError as error:
        print("Expected unknown-token explanation:", error)
    try:
        make_windows(["我 喜欢"], FIVE_WORD_TOKENIZER, block_size=2)
    except ValueError as error:
        print("Expected T+1 explanation:", error)
    print("No windows crossed a document boundary. Split documents BEFORE calling make_windows.")


if __name__ == "__main__":
    main()
