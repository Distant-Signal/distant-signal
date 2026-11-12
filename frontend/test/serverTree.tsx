import { Children, cloneElement, isValidElement, Suspense, type ReactNode } from 'react';

type AsyncComponent = (props: unknown) => Promise<ReactNode>;

function isAsyncComponent(type: unknown): type is AsyncComponent {
  return typeof type === 'function' && type.constructor.name === 'AsyncFunction';
}

/** Runs the async server components in a tree, the way the server does
 * before the HTML reaches a browser, and returns the plain tree. jsdom's
 * React can't render an async component, and a page that keeps its slow
 * data in `<Suspense><AsyncChild /></Suspense>` hands a test exactly that.
 * Only async components are called; client components (hooks) and DOM
 * elements are kept and only their `children` are walked. */
export async function resolveAsync(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child: ReactNode) => resolveAsync(child)));
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  if (isAsyncComponent(node.type)) return resolveAsync(await node.type(node.props));
  const { children } = node.props;
  if (children === undefined) return node;
  const resolved = await Promise.all(Children.toArray(children).map((child) => resolveAsync(child)));
  return cloneElement(node, undefined, ...resolved);
}

/** The tree the first flush of the HTML carries. An async component
 * outside any `Suspense` is awaited before the first byte, as the server
 * does, so it is resolved; a `Suspense` is its `fallback`, since its
 * children are still pending. What is left is what a crawler reads before
 * any streamed chunk arrives. */
export async function firstFlush(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child: ReactNode) => firstFlush(child)));
  if (!isValidElement<{ children?: ReactNode; fallback?: ReactNode }>(node)) return node;
  if (isAsyncComponent(node.type)) return firstFlush(await node.type(node.props));
  if (node.type === Suspense) return firstFlush(node.props.fallback ?? null);
  const { children } = node.props;
  if (children === undefined) return node;
  const kept = await Promise.all(Children.toArray(children).map((child) => firstFlush(child)));
  return cloneElement(node, undefined, ...kept);
}
