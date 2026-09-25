// Who this browser is to the other editors on a page: a name and a colour,
// kept in the browser like the edit/preview mode. Marqraft has no accounts.

const colours = ['#e0533d', '#2f855a', '#2b6cb0', '#b7791f', '#9f7aea', '#d53f8c', '#0f8a8a', '#6b5bd2'];
const animals = ['Heron', 'Otter', 'Lynx', 'Wren', 'Marten', 'Ibis', 'Gecko', 'Puffin', 'Tapir', 'Koala'];

export type Identity = { name: string; color: string };

const key = 'marqraft:identity';

export function identity(): Identity {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (stored?.name && stored?.color) return stored;
  } catch { /* storage unavailable or malformed: pick one for this page */ }
  const chosen = { name: animals[Math.floor(Math.random() * animals.length)], color: colours[Math.floor(Math.random() * colours.length)] };
  rename(chosen);
  return chosen;
}

export function rename(next: Identity) {
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
}
