import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import React from "react";
import { MantineProvider, createTheme, ColorSchemeScript, AppShell, Stack, Button, Tooltip, ActionIcon } from "@mantine/core";
import { Link, useLocation, useParams } from "@remix-run/react";
import { IconLayoutDashboard, IconFileText, IconBooks, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
});

export const links: LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ColorSchemeScript defaultColorScheme="light" />
        <Meta />
        <Links />
      </head>
      <body style={{ position: 'relative' }}>
        <MantineProvider theme={theme} withCssVariables>
          {children}
        </MantineProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const location = useLocation();
  const params = useParams();
  const isLanding = location.pathname === "/";
  const accountBookId = params.accountBookId || (location.pathname.startsWith('/dashboard/') ? location.pathname.split('/')[2] : (location.pathname.startsWith('/transactions/') ? location.pathname.split('/')[2] : undefined));
  const accountBookName = (typeof window !== 'undefined' && window.sessionStorage.getItem('pf_active_book_name')) || '';
  const [collapsed, setCollapsed] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const v = window.localStorage.getItem('pf_nav_collapsed');
    return v === '1';
  });
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('pf_nav_collapsed', collapsed ? '1' : '0');
    }
  }, [collapsed]);

  if (isLanding) return <Outlet />;

  const linkStyle: React.CSSProperties = { width: '100%', justifyContent: 'flex-start' };
  const isDash = accountBookId && location.pathname.startsWith(`/dashboard/${accountBookId}`);
  const isTx = accountBookId && location.pathname.startsWith(`/transactions/${accountBookId}`);

  return (
    <AppShell
      navbar={{ width: collapsed ? 72 : 220, breakpoint: 'sm' }}
      padding="md"
      withBorder={false}
      styles={{ main: { paddingLeft: collapsed ? 72 : 220, transition: 'padding-left 150ms ease' } }}
    >
      <AppShell.Navbar p="sm">
        <Stack gap="sm" align={collapsed ? 'center' : 'stretch'} style={{ height: '100%' }}>
          {collapsed ? (
            <ActionIcon variant="subtle" onClick={() => setCollapsed(false)} aria-label="Expand">
              <IconChevronRight size={16} />
            </ActionIcon>
          ) : (
            <Button variant="subtle" onClick={() => setCollapsed(true)} leftSection={<IconChevronLeft size={16} />}></Button>
          )}
          {!!accountBookId && !collapsed && (
            <div style={{ padding: 4, textAlign: 'left' }}>
              <strong style={{ fontSize: 12 }}>{accountBookName || 'Account Book'}</strong>
            </div>
          )}

          {/* Dashboard */}
          <Tooltip label="Dashboard" disabled={!collapsed} position="right">
            {collapsed ? (
              <ActionIcon component={Link} to={accountBookId ? `/dashboard/${accountBookId}` : '/'} variant={isDash ? 'filled' : 'subtle'} aria-label="Dashboard">
                <IconLayoutDashboard size={18} />
              </ActionIcon>
            ) : (
              <Button component={Link} to={accountBookId ? `/dashboard/${accountBookId}` : '/'} variant={isDash ? 'filled' : 'subtle'} leftSection={<IconLayoutDashboard size={18} />} style={linkStyle}>Dashboard</Button>
            )}
          </Tooltip>

          {/* Transactions */}
          <Tooltip label="Transactions" disabled={!collapsed} position="right">
            {collapsed ? (
              <ActionIcon component={Link} to={accountBookId ? `/transactions/${accountBookId}` : '/'} variant={isTx ? 'filled' : 'subtle'} aria-label="Transactions">
                <IconFileText size={18} />
              </ActionIcon>
            ) : (
              <Button component={Link} to={accountBookId ? `/transactions/${accountBookId}` : '/'} variant={isTx ? 'filled' : 'subtle'} leftSection={<IconFileText size={18} />} style={linkStyle}>Transactions</Button>
            )}
          </Tooltip>

          <div style={{ flex: 1 }} />

          {/* Exit */}
          <Tooltip label="Account Books" disabled={!collapsed} position="right">
            {collapsed ? (
              <ActionIcon component={Link} to="/" variant={'subtle'} aria-label="Exit to Account Books">
                <IconBooks size={18} />
              </ActionIcon>
            ) : (
              <Button component={Link} to="/" variant={'subtle'} leftSection={<IconBooks size={18} />} style={linkStyle}>Exit to Account Books</Button>
            )}
          </Tooltip>
        </Stack>
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
