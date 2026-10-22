# Settings and AI Coach

[Documentation home](INDEX.md) · [README](../README.md)

- [Settings, profile, and keeping the screen awake](#settings-profile-and-keeping-the-screen-awake)
- [Save changes](#save-changes)
- [Light theme](#light-theme)
- [Sign out](#sign-out)
- [Configure the Coach](#configure-the-coach)
- [Navigation during a response](#navigation-during-a-response)
- [Chat appearance](#chat-appearance)
- [Input and shortcuts](#input-and-shortcuts)
- [API key](#api-key)

## Settings, profile, and keeping the screen awake

Settings groups General, Profile, Session, AI Coach, and Advanced settings. General offers “Prevent
phone from locking,” disabled by default and applied after saving. The screen stays awake during
internal navigation and the lock is requested again when returning to the app.

This requires a compatible browser in a secure context and a visible page; the browser may suspend
it, especially in power-saving mode. Settings indicates incompatible browsers or a suspended lock;
no persistent confirmation text appears while the lock is active. See the [Screen Wake Lock
documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

The profile stores first name, sex, and date of birth; training settings belong to each program.

## Save changes

After a change, a save bar appears above navigation. **Save** saves the page's changes together;
**Cancel** restores saved values. Failure preserves drafts so you can retry.

## Light theme

The light theme distinguishes sections against a white background, strengthens field outlines, and
keeps text, states, and charts readable. Confirmed set values remain visible on mobile.

## Sign out

On the Authelia deployment, **Settings → Sign out** closes this device's session, including a
remembered session. The section displays only the button. Confirmation lets you preserve a draft
by cancelling. Saved data and the session in progress remain on the server; signing in again
restores access. The button appears only when the proxy provides this integration.

## Configure the Coach

The AI Coach uses an OpenAI-compatible API, configured with a URL, model, and optional API key.
Connection testing and model listing can use input before it is saved. The coach provides advice
and conversation; it does not configure the app or create programs.

## Navigation during a response

Chat remains active during navigation within the app: the coach continues responding on other
screens. Returning to chat always displays the end of the conversation, even while a response is
still streaming. Each addition of text immediately scrolls chat to the bottom, without animation
delay. When already following the latest message, it also readjusts when its visible area changes
size. Reading older messages preserves the scroll position across keyboard resize and pan events.
Only the message list scrolls: gestures at its boundaries do not scroll the underlying page.

Creating and deleting conversations is blocked during a response. This continuity applies to
internal navigation, not closing or reloading the app.

## Chat appearance

While thinking, three dots animate in sequence; animation respects the reduced-motion preference.
Chat displays only bubbles, without a robot emoji or user avatar.

## Input and shortcuts

The message field grows with its text up to 120 px, then allows scrolling through long messages.
It shrinks after clearing or sending; no scrollbar appears for short input. On desktop, Enter sends
the message and Shift + Enter adds a line. On mobile, Enter always adds a line; the send button
sends on all devices.

## API key

The key is stored server-side, masked in the interface, and excluded from API responses and JSON
exports. An existing key is preserved when a save does not provide a new one.
