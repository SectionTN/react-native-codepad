export const java = `package me.sectiontn.codepad.sample;

import java.util.List;
import java.util.Optional;

/** Picks the first entry whose score clears a threshold. */
public final class Ranker<T extends Comparable<T>> {
  private static final double THRESHOLD = 0.75;
  private final List<T> items;

  public Ranker(List<T> items) {
    this.items = List.copyOf(items);
  }

  @SuppressWarnings("unused")
  public Optional<T> best(double score) {
    if (score < THRESHOLD || items.isEmpty()) {
      return Optional.empty();
    }
    return items.stream().sorted().findFirst().map(item -> item);
  }

  @Override
  public String toString() {
    return "Ranker[" + items.size() + " items]";
  }
}
`;
