# Home Assistant: Distant Signal sensors with REST

This recipe shows your line status, your next journey and a train's delay
as Home Assistant sensors, using Home Assistant's built-in
[RESTful integration](https://www.home-assistant.io/integrations/rest/) and a
Distant Signal **personal API token**. You don't need a custom integration.

What the API can do is described in
[personal-api-tokens.md](../personal-api-tokens.md), and its full contract
is the OpenAPI document at `https://ds-api.cursed.solutions/v1/openapi.json`.

## 1. Create a token

1. Open **Connected apps** on your Distant Signal account page
   (`https://ds.cursed.solutions/account/connected-apps`).
2. Under **Personal API tokens**, name it (for example `Home Assistant`).
   Tick only what the sensors below need:
   - **See line status and station disruption** (`lines:read`)
   - **See your saved journeys** (`journeys:read`)
   - **See trains and live departures** (`trains:read`)
3. Choose an expiry and press **Create token**. Copy the `dsp_...` token
   straight away, because it is shown only once.

You'll get a push notice and a banner saying a token was created. That is
expected. If you ever see one you didn't expect, revoke the token in
Connected apps.

## 2. Store it as a secret

In `secrets.yaml`, store the whole header value, not just the token:

```yaml
distant_signal_auth: "Bearer dsp_your_token_here"
```

Never paste the token into `configuration.yaml` itself, a dashboard, or a
screenshot you share.

## 3. Add the sensors

In `configuration.yaml` (or a package file), add:

```yaml
rest:
  # Line status for the lines you care about. Use the ids from the website's
  # line pages (the last part of /lines/<id>), comma-separated.
  - resource: https://ds-api.cursed.solutions/v1/Line/c2c,elizabeth-shenfield/Status
    headers:
      Authorization: !secret distant_signal_auth
    # The API asks for no more than once a minute (DS-Poll-Interval: 60).
    scan_interval: 120
    sensor:
      - name: "c2c status"
        unique_id: distant_signal_c2c_status
        value_template: >-
          {% set line = value_json.data | selectattr('id', 'eq', 'c2c') | first %}
          {{ line.lineStatuses[0].statusSeverityDescription if line.lineStatuses else 'Good Service' }}
        json_attributes_path: "$.attribution"
        json_attributes:
          - sources
          - statement
      - name: "Elizabeth line (Shenfield) status"
        unique_id: distant_signal_elizabeth_shenfield_status
        value_template: >-
          {% set line = value_json.data | selectattr('id', 'eq', 'elizabeth-shenfield') | first %}
          {{ line.lineStatuses[0].statusSeverityDescription if line.lineStatuses else 'Good Service' }}

  # Your journeys: the next one's name and its train's delay.
  - resource: https://ds-api.cursed.solutions/v1/Journeys/mine
    headers:
      Authorization: !secret distant_signal_auth
    scan_interval: 120
    sensor:
      - name: "Next journey"
        unique_id: distant_signal_next_journey
        value_template: >-
          {% set upcoming = value_json.data | rejectattr('travelled') | list %}
          {% if upcoming %}
            {% set j = upcoming | first %}
            {{ j.customName or (j.firstOriginName ~ ' to ' ~ j.lastDestinationName) }}
          {% else %}None{% endif %}
      - name: "Next journey delay"
        unique_id: distant_signal_next_journey_delay
        unit_of_measurement: "min"
        value_template: >-
          {% set upcoming = value_json.data | rejectattr('travelled') | list %}
          {{ (upcoming | first).delayMinutes | default(0, true) if upcoming else 0 }}
```

Restart Home Assistant (or reload the RESTful integration). The sensors
appear as `sensor.c2c_status`, `sensor.next_journey` and so on.

Notes on the data:

- **The body:** every answer is `{ "data": ..., "attribution": ... }`; the
  sensors read `value_json.data`.
- **`lineStatuses`:** empty when a line has a good service. Each entry's
  `statusSeverityDescription` is the TfL-style wording ("Minor Delays",
  "Part Suspended" and so on).
- **`/v1/Journeys/mine`:** comes in travel order: what is still to come or
  under way first, soonest first, then what you have travelled. So the
  first one not yet `travelled` is the next (or current) journey. A journey's `delayMinutes` is its train
  leg's delay, or `null` before there is any live data.
- **Errors:**
  - `401` means the token is wrong, expired or revoked.
  - `403` means the token lacks the scope the route needs.
  - `429` means you are polling too often.

  The sensor then shows `unavailable`, and the Home Assistant log has the
  reason.

## 4. A train, on the day

To follow one train (for example the 07:42 you always catch), use its
timetable id and the date. You can find both on the train's page on the
website (`/train/<uid>/<date>`). A REST sensor's `resource_template`
(rather than `resource`) can build today's date:

```yaml
rest:
  - resource_template: >-
      https://ds-api.cursed.solutions/v1/Train/by-uid/C11052/{{ now().strftime('%Y-%m-%d') }}
    headers:
      Authorization: !secret distant_signal_auth
    scan_interval: 120
    sensor:
      - name: "07:42 delay"
        unique_id: distant_signal_0742_delay
        unit_of_measurement: "min"
        value_template: "{{ value_json.data.delayMinutes | default(0, true) }}"
      - name: "07:42 platform"
        unique_id: distant_signal_0742_platform
        value_template: "{{ value_json.data.platform or 'TBC' }}"
```

The train routes have a smaller budget (10 requests a minute per token), so
keep train sensors to a handful.

## 5. Show the credits

Wherever you show this data, a dashboard for example, show its credits as
well. They are a condition of the data's licences. Each response's
`attribution.sources[].notice` holds the exact wording, and the line status
sensor above keeps it as attributes. A Markdown card can show it:

```yaml
type: markdown
content: >-
  {% for s in state_attr('sensor.c2c_status', 'sources') or [] %}{{ s.notice }}<br>{% endfor %}
  {{ state_attr('sensor.c2c_status', 'statement') }}
```

A tiny display that can't fit the credits is fine for your own home. Don't
publish a dashboard built on this data without them.

## Limits and good manners

- **How often to poll:** once a minute at most. Every 2 minutes is plenty for
  status boards. One token allows 30 requests a minute (10 on the train
  routes), shared by all its sensors.
- **One token per device:** if a device is lost or retired, revoke just its
  token.
- **Expiry:** a token stops working at its expiry date, or after 90 days
  without use. Create a new one and update `secrets.yaml`.
