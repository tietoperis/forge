import importlib.machinery
import importlib.util
import unittest
from decimal import Decimal
from pathlib import Path

_path = str(Path(__file__).resolve().parents[1] / "banksummary")
_spec = importlib.util.spec_from_loader("banksummary", importlib.machinery.SourceFileLoader("banksummary", _path))
bs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bs)


class AmountTests(unittest.TestCase):
    def test_formats(self):
        for text in ["1234.56", "1234,56", "1,234.56", "1.234,56", "1 234,56", "€1234.56", "1234,56 €"]:
            self.assertEqual(bs.parse_amount(text), Decimal("1234.56"), text)
        self.assertEqual(bs.parse_amount("1,234"), Decimal("1234"))
        self.assertEqual(bs.parse_amount("-12,5"), Decimal("-12.5"))

    def test_rejects(self):
        for text in ["", "abc", "12a", "--5"]:
            with self.assertRaises(ValueError):
                bs.parse_amount(text)


class DateTests(unittest.TestCase):
    def test_formats(self):
        for text in ["2024-03-04", "04.03.2024", "04/03/2024", "4.3.2024"]:
            self.assertEqual(bs.parse_date(text).isoformat(), "2024-03-04")

    def test_rejects(self):
        for text in ["03/14/2024", "2024-02-30", "2024/03/04", "march 4"]:
            with self.assertRaises(ValueError):
                bs.parse_date(text)


class CategoryTests(unittest.TestCase):
    def test_whole_words_and_order(self):
        import re
        rules = [("Housing", [re.compile(r"(?<!\w)rent(?!\w)", re.I)]),
                 ("Other", [re.compile(r"(?<!\w)january(?!\w)", re.I)])]
        self.assertEqual(bs.categorise("RENT January", rules), "Housing")
        self.assertEqual(bs.categorise("Parent fee", rules), "uncategorised")
        self.assertEqual(bs.categorise("rent-payment", rules), "Housing")


if __name__ == "__main__":
    unittest.main()
