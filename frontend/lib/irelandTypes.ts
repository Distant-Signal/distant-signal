import type * as Api from './api-types';

/** The island-of-Ireland routes' response shapes
 * (`GET /public/island-of-ireland/...`), generated from the api's Rust
 * types (`lib/api-types.ts`). */

/** Whose feed a row comes from, not where the station is. */
export type IslandOfIrelandNetwork = Api.IslandOfIrelandStationResponse['network'];

export type IslandOfIrelandStationResponse = Api.IslandOfIrelandStationResponse;
export type IslandOfIrelandLineResponse = Api.IslandOfIrelandLineResponse;
export type IslandOfIrelandDepartureResponse = Api.IslandOfIrelandDepartureResponse;
export type IslandOfIrelandTrainResponse = Api.IslandOfIrelandTrainResponse;
export type IslandOfIrelandTrainCall = Api.IslandOfIrelandTrainCall;
export type IslandOfIrelandTrainLive = Api.IslandOfIrelandTrainLive;
export type LastLocation = Api.LastLocation;
