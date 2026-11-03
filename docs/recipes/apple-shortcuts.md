# Apple Shortcuts: ask Siri about your line and your next journey

This recipe builds two Shortcuts with a Distant Signal **personal API token**:

- **Line status:** "Hey Siri, how's my line?" reads out one line's status.
- **Next journey:** "Hey Siri, my next train" says your next journey and its
  delay.

They work on iPhone, iPad, Mac and Apple Watch, and from the Home Screen or a
widget. What the API can do is described in
[personal-api-tokens.md](../personal-api-tokens.md), and its full contract
is the OpenAPI document at `https://ds-api.cursed.solutions/v1/openapi.json`.

## 1. Create a token

1. Open **Connected apps** on your Distant Signal account page
   (`https://ds.cursed.solutions/account/connected-apps`).
2. Under **Personal API tokens**, name it (for example `iPhone Shortcuts`).
   Tick **See line status and station disruption** and **See your saved
   journeys**.
3. Press **Create token** and copy the `dsp_...` token. It is shown only
   once.

You'll get a push notice and a banner saying a token was created. If you
ever see one you didn't expect, revoke the token in Connected apps.

The token sits inside the Shortcut. **Don't share a Shortcut that has your
token in it.** Before sharing one, replace the token with a placeholder
(an **Ask for Input** or **Import Question** action), so the person
importing it pastes their own.

## 2. "How's my line?"

Create a Shortcut called **How's my line** with these actions:

1. **URL:** `https://ds-api.cursed.solutions/v1/Line/c2c/Status`. Use
   your line's id, the last part of its page address on the website
   (`/lines/<id>`).
2. **Get Contents of URL.** Show more, then set:
   - Method: **GET**
   - Headers: add one, key `Authorization`, value `Bearer dsp_your_token_here`
3. **Get Dictionary Value:** key `data`, from **Contents of URL**.
4. **Get Item from List:** **First Item**, from **Dictionary Value**. This
   is the line.
5. **Get Dictionary Value:** key `lineStatuses`, from **Item from List**.
6. **Count** the items in that **Dictionary Value**.
7. **If** **Count** is **0**:
   - **Text:** `Good service on the c2c.`
   - Otherwise:
     - **Get Item from List:** **First Item** of the `lineStatuses` value.
     - **Get Dictionary Value:** key `statusSeverityDescription`.
     - **Text:** `c2c: ` followed by that **Dictionary Value**, for
       example "c2c: Minor Delays".
   - **End If**
8. **Speak Text** with the result (or **Show Result**, for a widget).

Say "Hey Siri, how's my line" to run it.

A line with a good service has no `lineStatuses` at all, which is what the
**If** handles. A disrupted line has one entry per kind of disruption; read
them all with **Repeat with Each** if you want every one.

## 3. "My next train"

Create a Shortcut called **My next train**:

1. **URL:** `https://ds-api.cursed.solutions/v1/Journeys/mine`
2. **Get Contents of URL**, with the same `Authorization` header as above.
3. **Get Dictionary Value:** key `data`.
4. **Repeat with Each** item in **Dictionary Value**:
   - **Get Dictionary Value:** key `travelled`, from **Repeat Item**.
   - **If** it is **false**: **Add to Variable** `upcoming` (the
     **Repeat Item**).
   - **End If**
5. **End Repeat**.
6. **Get Item from List:** **First Item** from `upcoming`. Journeys come
   in travel order, so the first one not yet travelled is the next (or
   current) one.
7. From that item, use **Get Dictionary Value** to read:
   - `customName`, or `firstOriginName` and `lastDestinationName` when it
     has none;
   - `departsAt` (format it with **Format Date**, time only);
   - `delayMinutes` (empty before there is any live data).
8. **Text:** for example `Your 07:42 from Leigh-on-Sea to London Fenchurch
   Street is 3 minutes late.` (or `on time` when `delayMinutes` is 0 or
   empty).
9. **Speak Text**.

If `upcoming` is empty, say "No journeys coming up." instead.

## When it doesn't work

**Get Contents of URL** fails with the API's message:

| Status | Means |
|---|---|
| `401` | The token is wrong, has expired, was revoked, or went 90 days without use. Create a new one. |
| `403` | The token lacks the scope this route needs. Create one with the right boxes ticked. |
| `429` | Too many requests. Shortcuts run when you ask, so this only happens if an automation runs one in a tight loop. |

## Credits

Every response carries `attribution`: the credits for the data (National
Rail, Network Rail, Rail Delivery Group, RSP, TfL). A spoken answer can't
carry them, and that's fine for your own use. A Shortcut you publish, or a
widget others see, should show the `attribution.sources` notices.
