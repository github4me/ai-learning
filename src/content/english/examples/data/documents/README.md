# Small experiment with independent documents

These short English paragraphs are original teaching materials written for this
course (2026-09-08), not externally scraped or private data. Eight training and
three validation documents were split as whole documents in advance. They share
topics but not identical full texts. Validation documents do not supply gradients.

This is not a language benchmark. The dataset is small and shares an author's
style. The validation split teaches evaluation methodology; repeatedly tuning
against it prevents treating it as an untouched final test set.

`course_data.py` independently specifies a 30-character alphabet: lowercase
a–z, space, period, comma and newline. It is not learned from validation content.
There are no UNK, PAD, BOS or EOS tokens. CRLF is normalized to LF before
encoding; other unsupported characters are not silently converted.

`week12_generalization.py` constructs T+1 windows within individual documents
in each split. With stride=T, target positions do not overlap. A tail shorter
than T+1 is omitted, and the report records effective target counts. Windows do
not cross document boundaries or mix training and validation data.

Running produces `data_report.json`: document names, normalized-text SHA-256,
character counts, window counts, whole-document containment and intersections of
48-character fragments after whitespace normalization. This is a finite overlap
review, not proof that every near duplicate, topic bias or data issue is absent.
