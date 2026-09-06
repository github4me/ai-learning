TOKENS = (
    "<BOS>",
    "<EOS>",
    "<PAD>",
    "<UNK>",
    "我",
    "喜欢",
    "AI",
    "，",
    "也",
    "猫",
    "。",
)
TOKEN_TO_ID = {token: token_id for token_id, token in enumerate(TOKENS)}
ID_TO_TOKEN = {token_id: token for token, token_id in TOKEN_TO_ID.items()}

BOS_ID = TOKEN_TO_ID["<BOS>"]  # 0
EOS_ID = TOKEN_TO_ID["<EOS>"]  # 1
PAD_ID = TOKEN_TO_ID["<PAD>"]  # 2
UNK_ID = TOKEN_TO_ID["<UNK>"]  # 3

# Deterministic longest-first routing for this small teaching artifact.
# Equal-length routes retain this declared order.
CONTENT_ROUTES = ("喜欢", "AI", "我", "，", "也", "猫", "。")
HIDDEN_ON_DECODE_IDS = {BOS_ID, EOS_ID, PAD_ID}


class ReadableTokenizerV1:
    version = "w09-readable-v1"
    normalization = "identity"
    vocabulary = TOKENS

    def segment_content(self, text: str) -> list[str]:
        pieces: list[str] = []
        cursor = 0
        while cursor < len(text):
            matched = next(
                (
                    piece
                    for piece in CONTENT_ROUTES
                    if text.startswith(piece, cursor)
                ),
                None,
            )
            if matched is None:
                pieces.append("<UNK>")
                cursor += 1
            else:
                pieces.append(matched)
                cursor += len(matched)
        return pieces

    def encode_content(
        self,
        text: str,
        *,
        add_special_tokens: bool = False,
    ) -> list[int]:
        if add_special_tokens:
            raise ValueError("encode_content never adds BOS/EOS")
        return [TOKEN_TO_ID[piece] for piece in self.segment_content(text)]

    def encode_document(
        self,
        text: str,
        *,
        add_special_tokens: bool = True,
    ) -> list[int]:
        if not add_special_tokens:
            raise ValueError("use encode_content when boundaries are unwanted")
        return [
            BOS_ID,
            *self.encode_content(text, add_special_tokens=False),
            EOS_ID,
        ]

    def decode(
        self,
        ids: list[int],
        *,
        skip_special_tokens: bool = True,
    ) -> str:
        pieces: list[str] = []
        for token_id in ids:
            if token_id not in ID_TO_TOKEN:
                raise ValueError(f"token ID out of range: {token_id}")
            if skip_special_tokens and token_id in HIDDEN_ON_DECODE_IDS:
                continue
            pieces.append(ID_TO_TOKEN[token_id])
        return "".join(pieces)


W09_READABLE_V1 = ReadableTokenizerV1()


def encode_content(text: str) -> list[int]:
    return W09_READABLE_V1.encode_content(
        text,
        add_special_tokens=False,
    )


def encode_document(text: str) -> list[int]:
    return W09_READABLE_V1.encode_document(
        text,
        add_special_tokens=True,
    )


RUNNING_TEXT = "我喜欢AI，AI也喜欢猫。"
content_ids = encode_content(RUNNING_TEXT)
document_ids = encode_document(RUNNING_TEXT)

assert content_ids == [4, 5, 6, 7, 6, 8, 5, 9, 10]
assert document_ids == [0, *content_ids, 1]
assert W09_READABLE_V1.decode(
    document_ids,
    skip_special_tokens=True,
) == RUNNING_TEXT

# These calls never mutate vocabulary, routes, or IDs.
