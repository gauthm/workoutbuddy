# Mobile access and updates

[Documentation home](INDEX.md) · [README](../README.md)

## Local network access

Under **Settings → Advanced settings**, set the network host to `0.0.0.0`, save, and restart the
server. From a phone on the same network, open the machine's local IP address, for example
`http://192.168.1.10:3000`. The firewall must allow the selected port.

The app is intended for personal use on a trusted network: it has no built-in authentication and
must not be exposed directly to the Internet.

## Home screen installation

The dumbbell logo appears in the browser tab and when using **Share → Add to Home Screen** in
Safari. A 180×180 Apple PNG icon and 192/512 manifest icons complement the SVG/ICO favicon.

Their source is `public/icons/workoutbuddy.svg`; `node scripts/generate-icons.js` regenerates the
files using Playwright already available for tests, without adding a dependency. iOS may retain an
old icon for an existing shortcut: if necessary, remove the shortcut and add it again from Safari,
without clearing site data.

## Gestures and input

On mobile, pinch and double tap no longer zoom the page; touch scrolling remains native and
compact fields use at least 16 px to prevent Safari input zoom. Browser or system accessibility
settings can still override these rules.

When the on-screen keyboard opens, bottom navigation and the floating rest timer stay hidden
through scrolling on every page. They return when the keyboard closes. The AI Coach fits the
visible viewport so its message field remains directly above the keyboard, including when Safari
pans the page. The chat locks document scrolling while displayed; the message list scrolls
independently without dragging the page at its boundaries. Keyboard resizing preserves the reading
position when browsing older messages. Focusing a field with a hardware keyboard leaves navigation visible.

Dialog sheets also fit the visible area above the keyboard, including after rotation or viewport
panning. Long forms scroll inside the sheet so their Save and Cancel buttons remain reachable.

## Updates and reconnection

Over HTTPS, Safari and the home-screen app check for new versions on opening, on returning to the
foreground, and every five minutes during use. A complete release loads automatically on a
read-only screen. A single banner offers **Save and update** for settings (including profile and AI
configuration) and equipment inventory. It saves through the screen's usual validation, then reloads
only after success. A failed save keeps the draft and offers a retry. Open dialogs hide the banner.
Other data-entry screens and active workouts wait until the user saves and returns to a read-only
screen; the update never validates a workout set or submits a questionnaire on the user's behalf.

No hard refresh or clearing of site data is needed. The cache speeds up static files, but
navigations use the network: an expired session redirects to the authentication portal without a
misleading offline interface. API calls also distinguish an expired session from a network failure.
Each release must change the cache version.
