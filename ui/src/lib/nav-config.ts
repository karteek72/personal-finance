/** Shared dashboard navigation — keep sidebar and mobile nav in sync. */

export interface NavItem {
  href: string;
  label: string;
}

export interface NavSection {
  label: string | null;
  items: readonly NavItem[];
}

export const NAV_SECTIONS: readonly NavSection[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Home" },
      { href: "/transactions", label: "Activity" },
      { href: "/categories", label: "Spend" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/plan", label: "Plan" },
      { href: "/wealth", label: "Wealth" },
      { href: "/accounts", label: "Accounts" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/understand", label: "Insights" },
      { href: "/protect", label: "Protect" },
    ],
  },
  {
    label: null,
    items: [
      { href: "/family", label: "Family" },
      { href: "/profile", label: "Profile" },
    ],
  },
] as const;

/** High-traffic tabs pinned to the mobile bottom bar. */
export const MOBILE_PRIMARY_NAV: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Spend" },
  { href: "/transactions", label: "Activity" },
  { href: "/accounts", label: "Accounts" },
] as const;

export const MOBILE_MORE_NAV: readonly NavSection[] = NAV_SECTIONS.map(
  (section) => ({
    label: section.label,
    items: section.items.filter(
      (item) =>
        !MOBILE_PRIMARY_NAV.some((primary) => primary.href === item.href),
    ),
  }),
).filter((section) => section.items.length > 0);

export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function isMoreNavActive(pathname: string): boolean {
  return MOBILE_MORE_NAV.some((section) =>
    section.items.some((item) => isNavItemActive(pathname, item.href)),
  );
}
