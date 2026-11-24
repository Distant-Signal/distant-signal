// The frontend's build epoch: a whole number, bumped by hand in the pull
// request that makes older builds unsafe to keep running (an api change they
// cannot talk to). It is inlined into the browser bundle by next.config.mjs
// (`NEXT_PUBLIC_BUILD_EPOCH`) and compared with the operator's
// `FRONTEND_MIN_BUILD` floor (docs/frontend-min-build.md).
//
// Why a number kept in the source and not the build id or the Containers run
// id: the build id is a content hash with no order (scripts/build-id.mjs),
// and the run id is not known until after the image is built; baking either
// in would change the bundle on every build and undo the content-addressed
// build id. This file is itself a build input, so editing it changes the
// build id and no other build gets a new one.
export const BUILD_EPOCH = 1;
