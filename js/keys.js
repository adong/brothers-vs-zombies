/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "Brothers vs Zombies",
  keys: [
    ["pick a card", "1 – 9 or 0"],
    ["call your brother", "T"],
    ["take a defender back", "Q"],
    ["put the card back", "Esc"],
    ["pause", "P or Esc"],
    ["sound on / off", "M"],
    ["title: pick · easy · play", "← → · E · Enter"],
  ],
  touch: "Tap a card, then the grass. Tap ⭐ stars to collect them. The big face (bottom left) calls your brother.",
});
