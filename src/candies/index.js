// Candy Wall: registry of every candy on the wall (packs load independently so one broken file cannot take the game down).
async function load(path) {
  try {
    return (await import(path)).default || [];
  } catch (e) {
    console.error('[candies] pack failed: ' + path, e);
    return [];
  }
}

const want = new URLSearchParams(location.search).get('pack');
const ref = await load('./ref/index.js');
const packA = want === 'ref' ? [] : await load('./a/index.js');
const packB = want === 'ref' ? [] : await load('./b/index.js');

export const PACKS = { a: packA, b: packB, ref };
export const CANDIES = want && PACKS[want] ? PACKS[want] : packA.length + packB.length ? [...packA, ...packB] : ref;
