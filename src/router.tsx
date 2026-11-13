import React, { useEffect, useState } from 'react';

// 画面数が少ないため外部ライブラリを使わず History API で最小限のルーティングを行う

const NAVIGATE_EVENT = 'discotq:navigate';

export const navigate = (to: string, { replace = false } = {}) => {
  if (to === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState({}, '', to);
  else window.history.pushState({}, '', to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
  window.scrollTo(0, 0);
};

const currentLocation = () => ({ pathname: window.location.pathname, search: window.location.search });

export const useLocation = () => {
  const [location, setLocation] = useState(currentLocation);
  useEffect(() => {
    const update = () => setLocation(currentLocation());
    window.addEventListener('popstate', update);
    window.addEventListener(NAVIGATE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAVIGATE_EVENT, update);
    };
  }, []);
  return location;
};

export const useSearchParam = (name: string): string | null => {
  const { search } = useLocation();
  return new URLSearchParams(search).get(name);
};

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export const Link: React.FC<LinkProps> = ({ to, onClick, children, ...rest }) => (
  <a
    href={to}
    onClick={(e) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    }}
    {...rest}
  >
    {children}
  </a>
);
