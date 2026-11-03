/** The developer pages (`/developers`, `/developers/api`) and the recipes
 * they link to. The recipes are Markdown in the repository
 * (docs/recipes/), linked on GitHub rather than copied here, so there is
 * one copy to keep right. */
import { SOURCE_CODE_URL } from './sourceCode';

export const DEVELOPERS_PATH = '/developers';
export const API_REFERENCE_PATH = '/developers/api';
export const CONNECTED_APPS_PATH = '/account/connected-apps';

/** A file in the repository's default branch, on GitHub. */
export function repositoryFileUrl(path: string): string {
  return `${SOURCE_CODE_URL}/blob/main/${path}`;
}

export interface Recipe {
  title: string;
  description: string;
  url: string;
}

export const RECIPES: readonly Recipe[] = [
  {
    title: 'Home Assistant',
    description: "Your line status, your next journey and a train's delay as sensors, with the credits on a dashboard.",
    url: repositoryFileUrl('docs/recipes/home-assistant.md'),
  },
  {
    title: 'Apple Shortcuts',
    description: 'Ask Siri how your line is doing and about your next journey.',
    url: repositoryFileUrl('docs/recipes/apple-shortcuts.md'),
  },
];
