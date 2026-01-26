"""
Parser validation harness.

Generates coverage reports and validates parser output quality.
"""

import json
import statistics
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator


@dataclass
class PageStats:
    """Statistics for a single page."""
    url: str
    entry_count: int = 0
    senses_per_entry: list[int] = field(default_factory=list)
    examples_per_entry: list[int] = field(default_factory=list)
    entries_with_nko: int = 0
    entries_with_examples: int = 0
    entries_with_warnings: int = 0
    warning_types: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    extreme_entries: list[str] = field(default_factory=list)  # Entry IDs with >30 senses or >50 examples


@dataclass
class CoverageReport:
    """Overall coverage report."""
    pages: list[PageStats] = field(default_factory=list)
    total_entries: int = 0
    total_senses: int = 0
    total_examples: int = 0
    entries_with_nko: int = 0
    entries_with_examples: int = 0
    entries_with_warnings: int = 0
    warning_summary: dict[str, int] = field(default_factory=lambda: defaultdict(int))
    extreme_entries: list[dict] = field(default_factory=list)

    def add_page(self, stats: PageStats) -> None:
        """Add page stats to the report."""
        self.pages.append(stats)
        self.total_entries += stats.entry_count
        self.total_senses += sum(stats.senses_per_entry)
        self.total_examples += sum(stats.examples_per_entry)
        self.entries_with_nko += stats.entries_with_nko
        self.entries_with_examples += stats.entries_with_examples
        self.entries_with_warnings += stats.entries_with_warnings
        
        for wtype, count in stats.warning_types.items():
            self.warning_summary[wtype] += count
        
        for entry_id in stats.extreme_entries:
            self.extreme_entries.append({"url": stats.url, "entry_id": entry_id})

    def print_report(self) -> None:
        """Print the coverage report."""
        print("=" * 70)
        print("PARSER COVERAGE REPORT")
        print("=" * 70)
        print()
        
        print("## Overall Statistics")
        print(f"  Pages processed:        {len(self.pages)}")
        print(f"  Total entries:          {self.total_entries}")
        print(f"  Total senses:           {self.total_senses}")
        print(f"  Total examples:         {self.total_examples}")
        print()
        
        print("## N'Ko Coverage")
        pct_nko = (self.entries_with_nko / self.total_entries * 100) if self.total_entries else 0
        print(f"  Entries with N'Ko:      {self.entries_with_nko} ({pct_nko:.1f}%)")
        
        print()
        print("## Examples Coverage")
        pct_ex = (self.entries_with_examples / self.total_entries * 100) if self.total_entries else 0
        print(f"  Entries with examples:  {self.entries_with_examples} ({pct_ex:.1f}%)")
        
        print()
        print("## Senses per Entry")
        all_senses = [s for p in self.pages for s in p.senses_per_entry]
        if all_senses:
            print(f"  Min:    {min(all_senses)}")
            print(f"  Median: {statistics.median(all_senses)}")
            print(f"  Max:    {max(all_senses)}")
            print(f"  Mean:   {statistics.mean(all_senses):.2f}")
        
        print()
        print("## Examples per Entry")
        all_examples = [e for p in self.pages for e in p.examples_per_entry]
        if all_examples:
            print(f"  Min:    {min(all_examples)}")
            print(f"  Median: {statistics.median(all_examples)}")
            print(f"  Max:    {max(all_examples)}")
            print(f"  Mean:   {statistics.mean(all_examples):.2f}")
        
        print()
        print("## Warnings")
        print(f"  Entries with warnings:  {self.entries_with_warnings}")
        if self.warning_summary:
            print("  Warning types:")
            for wtype, count in sorted(self.warning_summary.items(), key=lambda x: -x[1]):
                print(f"    {wtype}: {count}")
        else:
            print("  (no warnings)")
        
        print()
        print("## Extreme Entries (>30 senses or >50 examples)")
        if self.extreme_entries:
            for entry in self.extreme_entries[:10]:
                print(f"  {entry['url']} #{entry['entry_id']}")
            if len(self.extreme_entries) > 10:
                print(f"  ... and {len(self.extreme_entries) - 10} more")
        else:
            print("  (none)")
        
        print()
        print("## Per-Page Summary")
        nko_header = "w/N'Ko"
        print(f"  {'Page':<50} {'Entries':>8} {nko_header:>8} {'w/Warn':>8}")
        print("  " + "-" * 74)
        for p in sorted(self.pages, key=lambda x: -x.entry_count):
            url_short = p.url.split("/")[-1] if "/" in p.url else p.url
            print(f"  {url_short:<50} {p.entry_count:>8} {p.entries_with_nko:>8} {p.entries_with_warnings:>8}")
        
        print()
        print("=" * 70)


def generate_coverage_report(ir_jsonl_path: Path) -> CoverageReport:
    """
    Generate a coverage report from IR JSONL output.
    
    Args:
        ir_jsonl_path: Path to the IR JSONL file
    
    Returns:
        CoverageReport with statistics
    """
    report = CoverageReport()
    page_stats: dict[str, PageStats] = {}
    
    with open(ir_jsonl_path, "r", encoding="utf-8") as f:
        for line in f:
            entry = json.loads(line)
            
            # Get URL from record_locator
            url = entry.get("record_locator", {}).get("url_canonical", "unknown")
            entry_id = entry.get("record_locator", {}).get("source_record_id", "?")
            
            if url not in page_stats:
                page_stats[url] = PageStats(url=url)
            
            stats = page_stats[url]
            stats.entry_count += 1
            
            fields_raw = entry.get("fields_raw", {})
            
            # Count senses
            senses = fields_raw.get("senses", [])
            num_senses = len(senses)
            stats.senses_per_entry.append(num_senses)
            
            # Count examples
            num_examples = sum(len(s.get("examples", [])) for s in senses)
            stats.examples_per_entry.append(num_examples)
            
            # N'Ko coverage
            if fields_raw.get("headword_nko_provided"):
                stats.entries_with_nko += 1
            
            # Examples coverage
            if num_examples > 0:
                stats.entries_with_examples += 1
            
            # Warnings
            warnings = entry.get("parse_warnings", [])
            if warnings:
                stats.entries_with_warnings += 1
                for w in warnings:
                    # Extract warning type (first word/colon-prefix)
                    wtype = w.split(":")[0] if ":" in w else w.split()[0] if w else "unknown"
                    stats.warning_types[wtype] += 1
            
            # Extreme entries
            if num_senses > 30 or num_examples > 50:
                stats.extreme_entries.append(entry_id)
    
    # Add all pages to report
    for stats in page_stats.values():
        report.add_page(stats)
    
    return report


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python validation.py <ir.jsonl>")
        sys.exit(1)
    
    report = generate_coverage_report(Path(sys.argv[1]))
    report.print_report()
