import { matchPath, type Location, type NavigateFunction } from "react-router-dom";
import { isDashboardPath, isSearchPath } from "./searchUrlParams";

export type ListReturnLocation = {
  pathname: string;
  search: string;
};

export type NavigationReturnState = {
  returnTo?: ListReturnLocation;
};

function isEntityListPath(pathname: string): boolean {
  return Boolean(
    matchPath("/investigators/:investigatorName", pathname)
    || matchPath("/organizations/:organizationName", pathname)
    || matchPath("/institutions/:institutionName", pathname),
  );
}

export function readReturnTo(location: Location): ListReturnLocation | null {
  const state = location.state as NavigationReturnState | null;
  const returnTo = state?.returnTo;
  if (!returnTo?.pathname) return null;
  return {
    pathname: returnTo.pathname,
    search: returnTo.search ?? "",
  };
}

/** Where "back" should land when opening a project from the current view. */
export function getListReturnForProjectNavigation(location: Location): ListReturnLocation | null {
  const preserved = readReturnTo(location);
  if (preserved) return preserved;

  const { pathname, search } = location;
  if (isDashboardPath(pathname) || isSearchPath(pathname) || isEntityListPath(pathname)) {
    return { pathname, search };
  }

  return null;
}

export function navigateToProject(
  navigate: NavigateFunction,
  projectId: string,
  returnTo: ListReturnLocation | null,
): void {
  navigate(`/projects/${encodeURIComponent(projectId)}`, {
    state: returnTo ? { returnTo } satisfies NavigationReturnState : undefined,
  });
}

export function navigateBackToList(
  navigate: NavigateFunction,
  location: Location,
  fallback: () => void,
): void {
  const returnTo = readReturnTo(location);
  if (!returnTo) {
    fallback();
    return;
  }

  navigate({
    pathname: returnTo.pathname,
    search: returnTo.search || undefined,
  });
}
