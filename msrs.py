"""This description goes to PyPI I think"""

__version__ = "0.0.1"

import argparse
import random
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date as datetime_date
from datetime import datetime, timedelta, timezone

import fsrs
import yaml

WIDTH = 60


def parse_date(value):
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc)

    if isinstance(value, datetime_date):
        return datetime.combine(value, datetime.min.time(), tzinfo=timezone.utc)

    return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)


current_date = datetime.now(timezone.utc)


@dataclass
class Card:
    user_rating: str
    question: str
    answers: list[any]
    added: datetime
    reviews: list[tuple[datetime, fsrs.Rating]]


# PARSE


def parse(file_str):
    # PYYAML crashes on literal tabs!
    file_str = file_str.replace("\t", "  ")

    document = yaml.safe_load(file_str)

    if not isinstance(document, dict):
        raise ValueError(
            "YAML file must contain a dictionary at the top level.")

    options = {
        "ratings": "1234",
        "desired_retention": 0.9,
        "daily_new_cards": 10,
    }

    cards = []
    for key, value in document.items():
        if key.startswith('.'):
            options[key[1:]] = value
            continue

        user_rating, question = parse_key(key)
        answers, added, reviews = parse_value(value)

        cards.append(Card(
            user_rating=user_rating,
            question=question,
            answers=answers,
            added=added,
            reviews=reviews,
        ))

    return (cards, options)


def parse_key(key):
    m = re.match(r'^[\u2500-\u257F]+(\S*)\s+', key)

    if not m:
        return ("", key)

    user_rating = m.group(1)
    question = key[m.end():]

    return (user_rating, question)


def parse_value(value):
    if value is None:
        return parse_value([])
    if not isinstance(value, list):
        return parse_value([value])

    answers = value
    added = datetime.now(timezone.utc)
    reviews = []

    if len(value):
        r = parse_date_dict(value[-1])
        if (r):
            added, reviews = r
            answers = value[:-1]

    return answers, added, reviews


def parse_date_dict(d):
    if not isinstance(d, dict):
        return

    date_literal_list = [
        (parse_date(date), literal)
        for date, literals in sorted(d.items())
        for literal in literals
        if isinstance(literals, list)
    ]

    if not len(date_literal_list):
        return

    added, added_literal = date_literal_list[0]
    if added_literal != "Added":
        return

    reviews = [
        (parse_date(date_str), fsrs.Rating[literal])
        for date_str, literal in date_literal_list[1:]
    ]

    return added, reviews

#
#
#
#
#


def review_card(card: Card, options):
    """Attempt to turn a user rating into a review"""

    user_rating = card.user_rating

    if not user_rating:
        return

    if not user_rating in options["ratings"]:
        print(
            f"Warning: rating '{user_rating}' not in '.ratings: {options['ratings']}'")
        return

    rating_index = options["ratings"].index(user_rating)
    rating = fsrs.Rating(rating_index + 1)  # Rating enum is 1-based

    card.reviews.append((current_date, rating))
    card.user_rating = ""


#
#
#


def get_due_date(reviews, desired_retention):

    scheduler = fsrs.Scheduler(
        desired_retention=desired_retention,

        # Fuzzing randomizes the due date
        # This doesn't prevent re-playing reviews
        # because the scheduler doesn't use the due date,
        # but it does make this function non-deterministic
        enable_fuzzing=True,

        # Intra-day intervals aren't relevant to us
        learning_steps=[timedelta(days=1)],
        relearning_steps=[timedelta(days=1)],
    )

    fsrs_card = fsrs.Card(card_id=0)
    for review_date, rating in reviews:
        fsrs_card, _ = scheduler.review_card(
            fsrs_card, rating, review_date
        )

    return fsrs_card.due


def schedule(cards: list[Card], options):
    new_cards = []
    calendar = defaultdict(list)

    for card in cards:
        if len(card.reviews):
            due_date = get_due_date(card.reviews, options["desired_retention"])
            calendar[due_date.date()].append(card)
        else:
            new_cards.append(card)

    date = current_date.date()
    while new_cards:
        date = date + timedelta(days=1)

        for _ in range(options["daily_new_cards"]):
            if not new_cards:
                break

            new_card = new_cards.pop()
            calendar[date].append(new_card)

    for _, cards in calendar.items():
        random.shuffle(cards)

    return calendar


def render(calendar, options):
    s = ""

    # Options
    for key, value in options.items():
        s += yaml.dump(
            {f".{key}": value},
            allow_unicode=True,
            sort_keys=False,
            width=WIDTH,
            Dumper=CustomDumper
        )

    s += "\n"
    # s += f"#{'-' * (WIDTH-1)}\n\n"

    for date, cards in reversed(sorted(calendar.items())):
        s += render_date_group(date, cards)
        s += "\n\n"

    return s


def render_date_group(date, cards: list[Card]):
    s = ""

    for i, card in enumerate(cards):

        drawings = "┌╴" if i == 0 else "├╴"
        if not card.reviews:
            for a, b in ["┌┏", "├┣", "╴╸"]:
                drawings = drawings.replace(a, b)

        key = drawings + card.user_rating + "\t" + card.question

        value = [*card.answers, render_history(card.added, card.reviews)]
        s += yaml.dump(
            {key: value},
            allow_unicode=True,
            sort_keys=False,
            width=WIDTH,
            Dumper=CustomDumper
        )

    s += f"#──╴{date}"  # + " ─────────────────"

    return s


def render_history(added, reviews: list[tuple[datetime, fsrs.Rating]]):
    date_dict = defaultdict(list)

    date_dict[added.date()] = ["Added"]

    for review_date, rating in reviews:
        date_dict[review_date.date()].append(rating.name)

    return dict(reversed(sorted(date_dict.items())))


class CustomDumper(yaml.Dumper):
    # https://reorx.com/blog/python-yaml-tips/#enhance-list-indentation-dump
    def increase_indent(self, flow=False, indentless=False):
        return super(CustomDumper, self).increase_indent(flow, False)

    def analyze_scalar(self, scalar):
        """Trick PYYAML into allowing tabs in unquoted strings"""
        no_tabs_here = scalar.replace("\t", "  ")
        analysis = super(CustomDumper, self).analyze_scalar(no_tabs_here)
        analysis.scalar = scalar
        return analysis


def list_representer(dumper: yaml.Dumper, data):
    flow_style = False
    if len(data) < 5 and all(
        isinstance(item, (int, float, bool, type(None))) or
        (isinstance(item, str) and len(item) <= 20)
        for item in data
    ):
        flow_style = True
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style)


def str_presenter(dumper, data):
    if '\n' in data:  # check for multiline string
        return dumper.represent_scalar('tag:yaml.org,2002:str', data, style='|')
    return dumper.represent_scalar('tag:yaml.org,2002:str', data)


yaml.add_representer(list, list_representer)
yaml.add_representer(str, str_presenter)

#


def update_file(file_path):
    with open(file_path, 'r') as file:
        file_str = file.read()

    cards, options = parse(file_str)

    for card in cards:
        review_card(card, options)

    calendar = schedule(cards, options)

    out_str = render(calendar, options)

    with open(file_path, "w") as file:
        file.write(out_str)


def main():
    arg_parser = argparse.ArgumentParser(
        description="TODO")
    arg_parser.add_argument(
        "file_path",
        type=str,
        help="Path to the YAML file to process."
    )
    args = arg_parser.parse_args()

    update_file(args.file_path)


#

if __name__ == "__main__":
    main()
