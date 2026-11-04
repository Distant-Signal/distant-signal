/** The landing repository: the frontend, the docs and the README that
 * indexes the others. Recipe links (lib/developerDocs.ts) are files in it. */
export const LANDING_REPOSITORY_URL = 'https://github.com/Distant-Signal/distant-signal';

/** Where Distant Signal's source code is: the landing README's repository
 * index (`#repositories`), which lists every repository the code is split
 * across (the frontend here; the api, pollers, ingest, workers and core
 * each in their own). Distant Signal is licensed AGPL-3.0-or-later, and
 * §13 of that licence asks a network service to offer its users the source
 * of what it runs, so the footer links here on every page and
 * `/attribution` says so (repo split spec §6). `/api/version` (the api's
 * `/public/version`) lists each running image with the repository and
 * exact commit it was built from. */
export const SOURCE_CODE_URL = `${LANDING_REPOSITORY_URL}#repositories`;

/** The licence, by its SPDX name and the GNU page for it. */
export const SOFTWARE_LICENCE_NAME = 'GNU Affero General Public License v3.0 or later';
export const SOFTWARE_LICENCE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';

/** The api's list of running images and their commits, through the
 * frontend's `/api` proxy. */
export const VERSION_PATH = '/api/version';
