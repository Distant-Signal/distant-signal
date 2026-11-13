'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Operator names by code, from the reference list, for the journey page's
 * client parts that are given a code only (an earlier plan's train, a
 * candidate train). Empty when the list could not be read: those parts then
 * show the code alone. */
const OperatorNamesContext = createContext<Readonly<Record<string, string>>>({});

export function OperatorNamesProvider({
  names,
  children,
}: {
  names: Readonly<Record<string, string>>;
  children: ReactNode;
}) {
  return <OperatorNamesContext.Provider value={names}>{children}</OperatorNamesContext.Provider>;
}

export function useOperatorNames(): Readonly<Record<string, string>> {
  return useContext(OperatorNamesContext);
}
