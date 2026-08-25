"""Translate JMdict part-of-speech descriptions (English) into short Vietnamese labels.

jamdict returns POS as full English phrases straight from the JMDict XML entities
(e.g. "noun (common) (futsuumeishi)", "Godan verb with 'ru' ending"). There is no
compact code to switch on, so exact matches are tried first for the phrases seen
most often in real lookups, then a keyword-substitution fallback covers the rest
so an unmapped phrase still renders in Vietnamese instead of raw English.
"""

# Exact-match table for the most common full POS phrases.
_EXACT_LABELS = {
    "noun (common) (futsuumeishi)": "Danh từ",
    "noun, used as a suffix": "Danh từ (hậu tố)",
    "noun, used as a prefix": "Danh từ (tiền tố)",
    "noun or participle which takes the aux. verb suru": "Danh từ / động từ する",
    "adjectival nouns or quasi-adjectives (keiyodoshi)": "Tính từ đuôi な",
    "pre-noun adjectival (rentaishi)": "Từ bổ nghĩa trước danh từ",
    "adjective (keiyoushi)": "Tính từ đuôi い",
    "adjective (keiyoushi) - yoi/ii class": "Tính từ đuôi い (nhóm いい/よい)",
    "Ichidan verb": "Động từ nhóm 2 (Ichidan)",
    "Godan verb - Iku/Yuku special class": "Động từ nhóm 1 (Godan, 行く)",
    "Godan verb with 'u' ending": "Động từ nhóm 1 (Godan, đuôi う)",
    "Godan verb with 'ku' ending": "Động từ nhóm 1 (Godan, đuôi く)",
    "Godan verb with 'gu' ending": "Động từ nhóm 1 (Godan, đuôi ぐ)",
    "Godan verb with 'su' ending": "Động từ nhóm 1 (Godan, đuôi す)",
    "Godan verb with 'tsu' ending": "Động từ nhóm 1 (Godan, đuôi つ)",
    "Godan verb with 'nu' ending": "Động từ nhóm 1 (Godan, đuôi ぬ)",
    "Godan verb with 'bu' ending": "Động từ nhóm 1 (Godan, đuôi ぶ)",
    "Godan verb with 'mu' ending": "Động từ nhóm 1 (Godan, đuôi む)",
    "Godan verb with 'ru' ending": "Động từ nhóm 1 (Godan, đuôi る)",
    "Godan verb with 'ru' ending (irregular verb)": "Động từ nhóm 1 (Godan, bất quy tắc)",
    "Suru verb - included": "Động từ する",
    "Suru verb - special class": "Động từ する (đặc biệt)",
    "Kuru verb - special class": "Động từ 来る",
    "noun or verb acting prenominally": "Danh từ / động từ bổ nghĩa cho danh từ",
    "adverb (fukushi)": "Trạng từ",
    "adverb taking the 'to' particle": "Trạng từ (đi với と)",
    "particle": "Trợ từ",
    "conjunction": "Liên từ",
    "interjection (kandoushi)": "Thán từ",
    "expressions (phrases, clauses, etc.)": "Cụm từ / thành ngữ",
    "pronoun": "Đại từ",
    "prefix": "Tiền tố",
    "suffix": "Hậu tố",
    "numeric": "Số từ",
    "counter": "Từ đếm",
    "auxiliary verb": "Trợ động từ",
    "auxiliary adjective": "Trợ tính từ",
    "transitive verb": "Ngoại động từ",
    "intransitive verb": "Nội động từ",
}

# Ordered (specific → generic) keyword fallback for phrases not covered above.
_KEYWORD_LABELS = [
    ("ichidan verb", "Động từ nhóm 2 (Ichidan)"),
    ("godan verb", "Động từ nhóm 1 (Godan)"),
    ("suru verb", "Động từ する"),
    ("kuru verb", "Động từ 来る"),
    ("transitive verb", "Ngoại động từ"),
    ("intransitive verb", "Nội động từ"),
    ("auxiliary verb", "Trợ động từ"),
    ("auxiliary adjective", "Trợ tính từ"),
    ("adjectival noun", "Tính từ đuôi な"),
    ("pre-noun adjectival", "Từ bổ nghĩa trước danh từ"),
    ("adjective", "Tính từ"),
    ("adverb", "Trạng từ"),
    ("conjunction", "Liên từ"),
    ("interjection", "Thán từ"),
    ("expression", "Cụm từ / thành ngữ"),
    ("pronoun", "Đại từ"),
    ("prefix", "Tiền tố"),
    ("suffix", "Hậu tố"),
    ("numeric", "Số từ"),
    ("counter", "Từ đếm"),
    ("particle", "Trợ từ"),
    ("noun", "Danh từ"),
    ("verb", "Động từ"),
]


def translate_pos_label(pos: str) -> str:
    """Return the Vietnamese label for one JMdict POS phrase, English if unknown."""
    if not pos:
        return ""
    exact = _EXACT_LABELS.get(pos)
    if exact:
        return exact
    lowered = pos.lower()
    for keyword, label in _KEYWORD_LABELS:
        if keyword in lowered:
            return label
    return pos


def translate_pos_list(pos_list: list) -> str:
    """Translate a list of JMdict POS phrases (one sense may carry several) and join them."""
    labels = []
    for pos in pos_list:
        label = translate_pos_label(pos)
        if label and label not in labels:
            labels.append(label)
    return ", ".join(labels)
