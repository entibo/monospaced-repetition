#cards
#reviews
#streak_days
review activity graph chart like on github profiles

[FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki/wiki/abc-of-fsrs)

# Tutorial

Add cards in `my_deck.yaml`

```yaml
Capital of Mexico: Mexico City

Pronounce "Laufey": # answer is optional

Spaced Repetion = ___ + ___:
  answer: testing + time
  source: https://ncase.me/remember/

Shuffle a list in Python: |
  import random

  my_list = [1,2,3,4,5]
  random.shuffle(my_list)
```

Run the command

In your editor, use **Fold All**

```yaml
┌╴  Shuffle a list in Python:
├╴  Spaced Repetion = ___ + ___:
├╴  Capital of Mexico:
├╴  Pronounce "Laufey":
#──╴2025-04-10
```

The cards are scheduled for tomorrow.

---

Go up the list, review each card and [rate your recall](#ratings).

Use **Unfold** or **Toggle Fold** to reveal the answer.

```yaml
.ratings: fhge # fail hard good easy

┌╴g Shuffle a list in Python:
├╴g Spaced Repetion = ___ + ___:
├╴e Capital of Mexico:
  - Mexico City
  - 2025-04-09: [Added]
├╴f Pronounce "Laufey":
#──╴2025-04-10
```

Run the command

```yaml
┌╴  Capital of Mexico:
  - Mexico City
  - 2025-04-10: [Easy]
    2025-04-09: [Added]
#──╴2025-04-27

┌╴  Spaced Repetion = ___ + ___:
├╴  Shuffle a list in Python:
#──╴2025-04-13

┌╴  Pronounce "Laufey":
#──╴2025-04-11
```

# Options

```yaml
.ratings: '1234'
.desired_retention: 0.9
.daily_new_cards: 10
```

## Ratings

1. `Again` Failed to recall—card is re-scheduled for tomorrow.
2. `Hard` Got it, but it took too much time and effort.
3. `Good` Ok.
4. `Easy` Effortless.

You should default to `Again` | `Good` and use the other two if you feel like the card showed up too soon or too late. The algorithm will use this to optimize its scheduling.

## Desired retention

Probability that you remember a card when it's due. 

Use this to control the frequency of reviews.

The algorithm models your forgetting curve—retention over time—for each card.

A lower value like 0.8 allows more time between reviews.  
A higher value like 0.98 ensures almost no lapses in memory, at the cost of performing many more reviews per day (with diminishing returns).

[More info in the Anki documentation](https://docs.ankiweb.net/deck-options.html#desired-retention)

## Daily new cards

Limit the number of new cards to be introduced per day.

This is useful when you've added a large number of cards at once.

As a rule of thumb, daily reviews will stabilize at around 10 times the number of new cards introduced per day.

Set to a high value, all new cards are scheduled for tomorrow.  
Set to 0, new cards are not scheduled; review them at your discretion.

---

### Todo: deterministic randomness so that re-running with the same data gives same output

# Tips

You don't have to follow the schedule to the letter.
TODO: move this into the part about retention

VSCode: task to run the program and then Fold all
Assign keybinding to task, or set as default build task

# Format

```coffee
for key, value in yaml_document
  if key.starts_with(".")
    yield Option(key, value)
  else if match, rating = key.matches(/^[\u2500-\u257F]+(\S*)\s+/)
    front = key.strip_prefix(match)
    [...back, history] = value
    yield Card(front, back, history, rating)
  else
    yield Card(key, [value], null, null)
```
