// End-to-end authoring gate: scaffolds a fresh site, drives the real editor in
// Chromium, restarts the browser session, and builds static output.
import { chromium } from '@playwright/test';
import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';

const temporary = await mkdtemp('/private/tmp/marqraft-browser-');
const site = temporary + '/site';
const environment = { ...process.env, TEY_KEX: process.env.TEY_KEX ?? `${process.env.HOME}/.local/share/tey/toolchains/0.4.0-beta.2/bin/kex`, KEX_ERL: process.env.KEX_ERL ?? '/opt/homebrew/opt/erlang/bin/erl' };
const escript = process.env.MARQ_ESCRIPT ?? '/opt/homebrew/opt/erlang/bin/escript';
const marq = (...args) => execFileSync(escript, ['ebin/marq', ...args], { env: environment, encoding: 'utf8' });
marq('new', site);
const port = Number(process.env.MARQ_PORT ?? 4174);
const server = spawn(escript, ['ebin/marq', 'dev', site, '--port', String(port)], { env: environment, stdio: 'pipe' });
let serverOutput = ''; server.stdout.on('data', d => { serverOutput += d; }); server.stderr.on('data', d => { serverOutput += d; });
const base = `http://localhost:${port}`;
for (let attempt = 0; attempt < 150; attempt++) {
  try { if ((await fetch(`${base}/__marqraft/project`)).ok) break; } catch {}
  if (server.exitCode !== null) throw new Error(serverOutput);
  await new Promise(resolve => setTimeout(resolve, 200));
}
const executablePath = process.env.MARQ_CHROME ?? '/Users/akos/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const browser = await chromium.launch({ executablePath, headless: true });
const step = name => console.log(`• ${name}`);
// The dialog is named by its visible title.
const conflictTitle = /changed on disk|Recover interrupted work/;
// The End key does not move the caret in a contenteditable on macOS, so place it
// at the end of an element through the selection API; the editor follows it.
const caretToEnd = async locator => {
  await locator.click();
  await locator.evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); range.collapse(false);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
  await locator.page().waitForTimeout(150);
};
const saved = async page => { await page.waitForTimeout(900); await page.getByRole('status').filter({ hasText: 'Saved' }).waitFor({ timeout: 20000 }); };
const noDialog = async page => assert.equal(await page.getByRole('dialog', { name: conflictTitle }).count(), 0, 'autosave must not conflict with its own write');
const ready = async page => { await page.getByRole('toolbar', { name: 'Formatting' }).waitFor({ timeout: 30000 }); };

const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
try {
  const errors = [];
  page.on('pageerror', error => { errors.push(error); console.error('PAGE ERROR:', error); });

  step('integrated chrome renders inside the theme');
  await page.goto(base); await ready(page);
  const icon = await fetch(`${base}/_theme/favicon.svg`);
  assert(icon.ok && icon.headers.get('content-type').startsWith('image/svg+xml'), 'theme assets are served in dev');
  const heading = page.locator('.site-content h2').first();
  const themed = async () => {
    assert.equal(await heading.evaluate(el => getComputedStyle(el).fontSize), '28px');
    assert.equal(await heading.evaluate(el => getComputedStyle(el).color), 'rgb(181, 42, 53)');
  };
  await themed();
  assert(await page.locator('.site-navigation').getByRole('button', { name: 'New page' }).isVisible(), 'new page button sits under the page list');
  // The home page is not in the page list; the tutorial collection is.
  assert.equal(await page.locator('.site-navigation a[aria-current=page]').count(), 0);
  assert.equal(await page.locator('.site-navigation a', { hasText: 'Getting started' }).count(), 1);

  step('typing survives autosave with undo and focus intact');
  await caretToEnd(heading); await page.keyboard.type(' gate');
  await saved(page); await noDialog(page);
  await page.keyboard.type(' history'); await page.waitForTimeout(1200);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(1200);
  assert(!(await heading.textContent()).includes('history'));
  assert((await heading.textContent()).includes('gate'));
  await themed();
  assert(await page.locator('.ProseMirror-focused').count() > 0);

  step('formatting toolbar applies marks');
  await caretToEnd(page.locator('.site-content p').first());
  await page.keyboard.down('Shift'); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft'); await page.keyboard.up('Shift');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  assert(await page.locator('.site-content p strong').count() > 0);
  await saved(page);

  step('generated block settings and repeatable areas');
  await page.locator('.marq-code').first().hover();
  await page.getByRole('button', { name: 'Code settings', exact: true }).click();
  await page.getByLabel('Filename', { exact: true }).fill('literal <&>.kex');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add tab', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tab label', exact: true }).last().fill('Third');
  await page.getByRole('button', { name: 'Move tab up', exact: true }).last().click();
  await saved(page); await noDialog(page);
  await page.reload(); await ready(page);
  assert.equal(await page.getByRole('textbox', { name: 'Tab label', exact: true }).count(), 3);
  assert.equal(await page.getByRole('textbox', { name: 'Tab label', exact: true }).nth(1).inputValue(), 'Third');
  assert((await page.locator('.marq-code figcaption').first().textContent()).includes('literal <&>.kex'));

  step('slash command inserts a GitHub alert saved as Markdown');
  await caretToEnd(page.locator('.site-content p').first()); await page.keyboard.press('Enter');
  await page.keyboard.type('/callo');
  await page.getByRole('listbox', { name: 'Insert block' }).waitFor();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Editable nested content');
  const alert = page.locator('.site-content .markdown-alert').first();
  await alert.hover();
  await page.getByRole('button', { name: 'Callout settings', exact: true }).first().click();
  await page.getByRole('combobox', { name: 'Kind' }).click();
  await page.getByRole('option', { name: 'warning' }).click();
  await page.keyboard.press('Escape');
  await alert.and(page.locator('.markdown-alert-warning')).waitFor();
  await saved(page); await noDialog(page);
  assert((await readFile(site + '/content/index.md', 'utf8')).includes('> [!WARNING]\n> Editable nested content'));
  await page.reload(); await ready(page);
  assert((await page.locator('.site-content .markdown-alert-warning').textContent()).includes('Editable nested content'));

  step('theme settings preview live and persist');
  await page.getByRole('button', { name: 'Theme', exact: true }).click();
  await page.getByRole('textbox', { name: 'Accent color', exact: true }).fill('#225588');
  assert.equal(await heading.evaluate(el => getComputedStyle(el).color), 'rgb(34, 85, 136)');
  await page.getByRole('button', { name: 'Save theme settings' }).click();
  await page.getByRole('alert').filter({ hasText: 'Theme settings saved' }).waitFor();
  assert((await readFile(site + '/marqraft.jsonc', 'utf8')).includes('#225588'));
  await page.getByRole('button', { name: 'Close panel' }).click();

  step('preview hides authoring chrome and stays on across pages and reloads');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const previewing = async () => {
    await page.getByRole('button', { name: 'Edit', exact: true }).waitFor();
    assert(!(await page.getByRole('toolbar', { name: 'Formatting' }).isVisible()));
    assert(!(await page.locator('.site-navigation').getByRole('button', { name: 'New page' }).isVisible()));
    assert.equal(await page.locator('.marq-document').getAttribute('contenteditable'), 'false');
  };
  await previewing();
  await page.locator('.site-navigation a', { hasText: 'Getting started' }).click();
  await page.waitForURL(`${base}/tutorial/`); await previewing();
  await page.reload(); await previewing();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await ready(page);
  await page.goto(base); await ready(page);

  step('new page is created inline from the navigation and opens as a draft');
  await page.locator('.site-navigation').getByRole('button', { name: 'New page' }).click();
  await page.getByRole('textbox', { name: 'Page title' }).fill('Variables & Types');
  assert.equal(await page.getByRole('textbox', { name: 'URL path' }).inputValue(), '/variables-types/');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(`${base}/variables-types/`); await ready(page);
  assert.equal(await page.locator('[data-marq-title]').textContent(), 'Variables & Types');
  assert(await page.locator('.site-navigation a[aria-current=page] .marq-draft').count() === 1);

  step('subpage from the page menu nests under its parent');
  await page.locator('.site-navigation a', { hasText: 'Getting started' }).hover();
  await page.getByRole('button', { name: 'Getting started options' }).click();
  await page.getByRole('menuitem', { name: 'Add subpage' }).click();
  await page.getByRole('textbox', { name: 'Page title' }).fill('Installing');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(`${base}/tutorial/installing/`); await ready(page);
  const navigation = JSON.parse(await readFile(site + '/.marqraft/navigation.json', 'utf8'));
  // The home page is not in navigation.json, so Getting started is the first entry.
  assert.equal(navigation[0].children.length, 1, 'subpage is nested under Getting started');

  step('publishing and reordering keep URLs stable');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await saved(page);
  assert.equal(await page.locator('.site-navigation a[aria-current=page] .marq-draft').count(), 0);
  await page.locator('.site-navigation a', { hasText: 'Variables & Types' }).hover();
  await page.getByRole('button', { name: 'Variables & Types options' }).click();
  await page.getByRole('menuitem', { name: 'Move up' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.site-navigation > div > ul > li > .marq-nav-row a')[0]?.textContent?.startsWith('Variables'));
  assert.equal(page.url(), `${base}/tutorial/installing/`);

  step('clean documents reload external edits in place');
  await page.goto(base); await ready(page);
  const initialSource = await readFile(site + '/content/index.md', 'utf8');
  await writeFile(site + '/content/index.md', initialSource + '\nClean external edit\n');
  await page.locator('.site-content', { hasText: 'Clean external edit' }).waitFor({ timeout: 15000 });
  await noDialog(page);

  step('external edits overlapping unsaved work keep both versions');
  await page.route('**/__marqraft/save', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"kind":"validation","message":"simulated failure"}}' }));
  await caretToEnd(page.locator('.site-content p').first()); await page.keyboard.type(' unsaved local work');
  await page.getByRole('status').filter({ hasText: 'Not saved' }).waitFor({ timeout: 15000 });
  const source = await readFile(site + '/content/index.md', 'utf8');
  await writeFile(site + '/content/index.md', source + '\nExternal edit\n');
  await page.getByRole('dialog', { name: conflictTitle }).waitFor({ timeout: 15000 });
  assert((await page.getByRole('textbox', { name: 'Disk version' }).inputValue()).includes('External edit'));
  assert((await page.getByRole('textbox', { name: 'Your version' }).inputValue()).includes('unsaved local work'));
  assert(!(await readFile(site + '/content/index.md', 'utf8')).includes('unsaved local work'), 'nothing is overwritten while unresolved');
  await page.unroute('**/__marqraft/save');
  await page.getByRole('button', { name: 'Save reviewed local version', exact: true }).click();
  await page.waitForEvent('load'); await ready(page);
  assert((await readFile(site + '/content/index.md', 'utf8')).includes('unsaved local work'));
  await page.screenshot({ path: temporary + '/authoring.png', fullPage: false });

  step('static build has no authoring runtime and omits drafts');
  marq('build', site);
  const home = await readFile(site + '/dist/index.html', 'utf8');
  assert(!home.includes('__marqraft') && !home.includes('data-marq') && !home.includes('marqraft-content'));
  assert(home.includes('<link rel="icon" href="/_theme/favicon.svg" type="image/svg+xml">'), 'the theme favicon is linked');
  assert((await readFile(site + '/dist/_theme/favicon.svg', 'utf8')).startsWith('<svg'), 'theme assets are copied into the build');
  assert(home.includes('Installing') && home.includes('#225588'));
  // Installing was published above; Variables & Types is still a draft.
  await stat(site + '/dist/tutorial/installing/index.html');
  await assert.rejects(stat(site + '/dist/variables-types/index.html'));
  assert(!home.includes('Variables &amp; Types'), 'drafts are absent from published navigation');
  assert.equal(errors.length, 0, 'no uncaught page errors');
  console.log(`Browser gate passed. Fixture and screenshot: ${temporary}`);
} catch (error) {
  console.error(serverOutput.slice(-3000));
  await page.screenshot({ path: temporary + '/failure.png' }).catch(() => {});
  console.error(`Failure screenshot: ${temporary}/failure.png`);
  throw error;
} finally { await browser.close(); server.kill('SIGTERM'); }
