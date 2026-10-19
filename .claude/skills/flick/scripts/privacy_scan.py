#!/usr/bin/env python3
"""Screen candidate brain-note text against the hard rules in PRIVACY.md.

This repo is public, so a note goes in only after this scan is clean. The scan
is deliberately noisy rather than clever: a false alarm costs one sentence of
human judgement, a miss leaks a secret into public git history forever.

Usage:
    python3 privacy_scan.py <file>        # scan a file
    python3 privacy_scan.py -             # scan stdin

Exit codes:
    0  no findings
    1  findings (printed as "LINE:RULE:excerpt")
    2  usage error
"""

import re
import sys

# (rule name, compiled pattern, why it matters)
RULES = [
    ("private-key-block",
     re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
     "private key material"),
    ("token-prefix",
     re.compile(r"\b(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}"
                r"|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}"
                r"|AKIA[0-9A-Z]{16}|AIza[A-Za-z0-9_-]{30,}"
                r"|glpat-[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{30,})\b"),
     "looks like a live API key or token"),
    ("jwt",
     re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
     "looks like a JWT"),
    ("assigned-secret",
     re.compile(r"(?i)\b(api[_ -]?key|secret|token|password|wachtwoord|passwd"
                r"|credential|private[_ -]?key)\b\s*[:=]\s*\S{6,}"),
     "a secret-shaped name with a value assigned to it"),
    ("seed-phrase",
     re.compile(r"(?i)\b(seed[_ -]?phrase|mnemonic|recovery[_ -]?phrase"
                r"|herstelzin|seed[_ -]?woorden)\b"),
     "wallet recovery material"),
    ("local-path",
     re.compile(r"(?:[A-Za-z]:\\Users\\[^\\\s]+|/Users/(?!$)[^/\s]+|/home/(?!$)[^/\s]+)"),
     "a path on a personal machine (PRIVACY.md forbids machine details)"),
    ("iban",
     re.compile(r"\b[A-Z]{2}\d{2}[ ]?[A-Z0-9]{4}(?:[ ]?\d{4}){2,4}\b"),
     "looks like a bank account number"),
    ("money-amount",
     re.compile(r"(?:[€$£]\s?\d[\d.,]{2,}|\b\d[\d.,]{2,}\s?(?:EUR|USD|euro)\b)"),
     "a concrete money amount (personal financials are forbidden)"),
    ("email",
     re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
     "an email address"),
    ("ip-address",
     re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
     "an IP address"),
]

# Placeholders are the whole point of PRIVACY.md's "configuratievoorbeelden
# zonder echte credentials" allowance, so don't cry wolf over them.
PLACEHOLDER = re.compile(
    r"(?i)(xxx+|\.\.\.|<[^>]{2,}>|\{\{.*?\}\}|\byour[_ -]|\bexample\b|\bdummy\b"
    r"|\bplaceholder\b|\bredacted\b|\bvoorbeeld\b|\*{3,})"
)


def scan(text):
    findings = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        for name, pattern, why in RULES:
            for match in pattern.finditer(line):
                excerpt = match.group(0)
                # Judge the matched span itself, not the whole line: a line that
                # happens to say "example" elsewhere should not hide a real key.
                if PLACEHOLDER.search(excerpt):
                    continue
                if len(excerpt) > 60:
                    excerpt = excerpt[:57] + "..."
                findings.append((lineno, name, excerpt, why))
    return findings


def main(argv):
    if len(argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    target = argv[1]
    text = sys.stdin.read() if target == "-" else open(target, encoding="utf-8").read()

    findings = scan(text)
    if not findings:
        print("PRIVACY SCAN: clean")
        return 0

    print(f"PRIVACY SCAN: {len(findings)} finding(s) — do not commit as-is\n")
    for lineno, name, excerpt, why in findings:
        print(f"  line {lineno}  [{name}]  {excerpt}\n           -> {why}")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
