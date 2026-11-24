# Retiring old frontend builds: the reload hint

An installed app (a PWA) or a tab left open can keep running an old frontend
build for days. When an api change means old builds must not keep running (for
example rejecting numeric ids, the stage 3 plan in
[frontend-build-mix.md](frontend-build-mix.md)), the operator sets a floor and
older builds ask their user to reload.

## Build epochs

Every build carries a build epoch: a whole number kept in
`frontend/scripts/build-epoch.mjs` and inlined into the browser bundle
(`NEXT_PUBLIC_BUILD_EPOCH`, `next.config.mjs`). It starts at 1. The pull
request that makes older builds unsafe bumps it by one; nothing else changes
it. It is not the build id (a content hash with no order,
`scripts/build-id.mjs`) and not the Containers run id: baking the run id into
the bundle would make every build differ and undo the content-addressed build
id, and it is not known until after the image is built.

## Turning it on

Set `FRONTEND_MIN_BUILD` on the frontend to the lowest epoch that may keep
running, for example `2`.

| Value | Effect |
|---|---|
| unset or empty | Off. The default. No header, no banner. |
| a whole number (1 to 15 digits, no leading zero) | Builds with a lower epoch show the hint. |
| anything else | Ignored, with one `WARN` log line (`FRONTEND_MIN_BUILD is not a whole number, ignoring it`). |

The value is read on every request, so a restart is all it takes. To turn it
off, unset it again.

## What happens

- The `/api/[...path]` proxy adds `X-DS-Min-Build: <n>` to every response,
  its own errors included, only when the variable is valid.
- The root layout also passes the floor to the client, so it reaches a page on
  every navigation and every 30 second refresh, with no extra request. An idle
  installed shell therefore learns it without calling the api.
- A page whose epoch is below the floor shows a non-blocking status
  message at the bottom of the screen: "A new version of Distant Signal is available."
  with a Reload button. It takes no focus, does not cover the page content
  beyond its own box, and goes away with the reload.
- Reload asks the service worker to check for a new `sw.js`
  (`registration.update()`, at most 3 seconds), then reloads. A reload is a
  navigation, and `public/sw.js` sends navigations to the network, so the page
  always comes from the current build; the update check moves the worker's
  caches to the new build as well.
- It never reloads by itself: the page cannot know that no form input would be
  lost, so the user decides.
- No hint when the floor is unset, when this build has no epoch (tests), or
  when the build is at or above the floor.

Limit: a build from before this feature has no hint component, so the floor
cannot retire it. It leaves through the service worker's own update, or when
its user next opens the app.

## What ds-deploy needs

A chart value, default empty, rendered into the frontend container's env.
In `charts/distant-signal/values.yaml`, under `frontend:`:

```yaml
  # Lowest frontend build epoch allowed to keep running; older builds show a
  # reload hint (docs/frontend-min-build.md in the frontend repository).
  # Empty turns it off.
  minBuild: ""
```

In the frontend Deployment's container `env`:

```yaml
            {{- with .Values.frontend.minBuild }}
            - name: FRONTEND_MIN_BUILD
              value: {{ . | quote }}
            {{- end }}
```

Raising the floor is then a Ranma-Config values change, after the frontend
build that carries the new epoch is deployed. (Do it in that order: a floor
above every deployed build would offer a reload that cannot help.)

## Checking it

`curl -sI https://<host>/api/Line/Mode/tube/Status | grep -i x-ds-min-build`
shows the header when set. The unit tests cover the parser, the header and the
component; `e2e/build-update-notice.spec.ts` forces the state with an
intercepted response and runs axe on it.
